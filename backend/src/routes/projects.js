const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query, transaction } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createNotification, notifyProjectParticipants } = require('../notifications');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    cb(null, `${suffix}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/octet-stream'
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.zip', '.txt', '.md', '.json', '.csv', '.sql', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.php', '.rb', '.go', '.png'].includes(ext);

    if (allowed.includes(file.mimetype) || isAllowedExt) {
      return cb(null, true);
    }

    return cb(new Error('Unsupported file type. Only images, PDFs, ZIP files and common source/docs are allowed.'));
  }
});

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeProject(row) {
  const taskCount = Number(row.task_count || 0);
  const milestoneCount = Number(row.milestone_count || 0);
  const progressTotal = taskCount || milestoneCount;
  const progressComplete = taskCount
    ? Number(row.completed_task_count || 0)
    : Number(row.completed_milestone_count || 0);

  return {
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    sectionId: row.section_id,
    sectionName: row.section_name || null,
    semester: row.semester || null,
    studentId: row.student_id,
    studentName: row.student_name || null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    archivedAt: row.archived_at,
    fileCount: Number(row.file_count || 0),
    milestoneCount,
    taskCount,
    progressPercent: progressTotal ? Math.round((progressComplete / progressTotal) * 100) : 0
  };
}

async function findProject(projectId) {
  const rows = await query(
    `SELECT p.project_id, p.student_id, p.section_id, p.category_id, p.title, p.description,
            p.status, p.visibility, p.created_at, p.submitted_at, p.archived_at,
            c.name AS category_name,
            s.section_name, s.semester,
            u.name AS student_name,
            (SELECT COUNT(*) FROM project_files pf WHERE pf.project_id = p.project_id) AS file_count,
            (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id) AS milestone_count,
            (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id AND m.status = 'Completed') AS completed_milestone_count,
            (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id) AS task_count,
            (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id AND mt.status = 'Completed') AS completed_task_count
       FROM projects p
       LEFT JOIN categories c ON c.category_id = p.category_id
       LEFT JOIN sections s ON s.section_id = p.section_id
       JOIN users u ON u.user_id = p.student_id
      WHERE p.project_id = ?
      LIMIT 1`,
    [projectId]
  );

  return rows[0] || null;
}

async function userCanAccessProject(user, projectId) {
  const project = await findProject(projectId);
  if (!project) return { project: null, allowed: false };

  if (user.role === 'Teacher') {
    const rows = await query(
      'SELECT section_id FROM sections WHERE section_id = ? AND teacher_id = ? LIMIT 1',
      [project.section_id, user.id]
    );
    return { project, allowed: rows.length > 0 };
  }

  return { project, allowed: Number(project.student_id) === Number(user.id) };
}

function normalizeReview(row) {
  return {
    reviewId: row.review_id,
    projectId: row.project_id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    decision: row.decision,
    feedback: row.feedback,
    marks: Number(row.marks),
    rating: Number(row.rating),
    reviewedAt: row.reviewed_at
  };
}

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'Teacher') {
    const projects = await query(
      `SELECT p.project_id, p.student_id, p.section_id, p.category_id, p.title, p.description,
              p.status, p.visibility, p.created_at, p.submitted_at, p.archived_at,
              c.name AS category_name,
              s.section_name, s.semester,
              u.name AS student_name,
              (SELECT COUNT(*) FROM project_files pf WHERE pf.project_id = p.project_id) AS file_count,
              (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id) AS milestone_count,
              (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id AND m.status = 'Completed') AS completed_milestone_count,
              (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id) AS task_count,
              (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id AND mt.status = 'Completed') AS completed_task_count
         FROM projects p
         LEFT JOIN categories c ON c.category_id = p.category_id
         LEFT JOIN sections s ON s.section_id = p.section_id
         JOIN users u ON u.user_id = p.student_id
        WHERE s.teacher_id = ?
        ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    return res.json({ projects: projects.map(normalizeProject) });
  }

  const projects = await query(
    `SELECT p.project_id, p.student_id, p.section_id, p.category_id, p.title, p.description,
            p.status, p.visibility, p.created_at, p.submitted_at, p.archived_at,
            c.name AS category_name,
            s.section_name, s.semester,
            u.name AS student_name,
            (SELECT COUNT(*) FROM project_files pf WHERE pf.project_id = p.project_id) AS file_count,
            (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id) AS milestone_count,
            (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.project_id AND m.status = 'Completed') AS completed_milestone_count,
            (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id) AS task_count,
            (SELECT COUNT(*) FROM milestone_tasks mt JOIN milestones m ON m.milestone_id = mt.milestone_id WHERE m.project_id = p.project_id AND mt.status = 'Completed') AS completed_task_count
       FROM projects p
       LEFT JOIN categories c ON c.category_id = p.category_id
       LEFT JOIN sections s ON s.section_id = p.section_id
       JOIN users u ON u.user_id = p.student_id
      WHERE p.student_id = ?
      ORDER BY p.created_at DESC`,
    [req.user.id]
  );

  return res.json({ projects: projects.map(normalizeProject) });
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: 'Only students can create project repositories.' });
  }

  const { title, description, sectionId, categoryId, visibility } = req.body || {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanDescription = typeof description === 'string' ? description.trim() : '';
  const cleanSectionId = parseId(sectionId);
  const cleanCategoryId = parseId(categoryId);
  const cleanVisibility = visibility === 'Public' ? 'Public' : 'Private';

  if (cleanTitle.length < 3 || cleanTitle.length > 160) {
    return res.status(400).json({ error: 'Project title must be between 3 and 160 characters.' });
  }
  if (cleanDescription.length < 10 || cleanDescription.length > 5000) {
    return res.status(400).json({ error: 'Project description must be between 10 and 5000 characters.' });
  }
  if (!cleanSectionId) {
    return res.status(400).json({ error: 'Please choose a valid section.' });
  }
  if (!cleanCategoryId) {
    return res.status(400).json({ error: 'Please choose a valid category.' });
  }

  const sectionCheck = await query(
    'SELECT section_id FROM enrollments WHERE section_id = ? AND student_id = ? LIMIT 1',
    [cleanSectionId, req.user.id]
  );
  if (sectionCheck.length === 0) {
    return res.status(400).json({ error: 'You can only create projects for your enrolled sections.' });
  }

  const categoryCheck = await query(
    'SELECT category_id FROM categories WHERE category_id = ? LIMIT 1',
    [cleanCategoryId]
  );
  if (categoryCheck.length === 0) {
    return res.status(400).json({ error: 'The selected category does not exist.' });
  }

  const result = await query(
    'INSERT INTO projects (student_id, section_id, category_id, title, description, visibility, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, cleanSectionId, cleanCategoryId, cleanTitle, cleanDescription, cleanVisibility, 'Draft']
  );

  const project = await findProject(result.insertId);
  return res.status(201).json({ project: normalizeProject(project) });
});

function validDate(value) {
  if (value === undefined || value === null || value === '') return { valid: true, value: null };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, value: null };
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { valid: false, value: null };
  }

  return { valid: true, value };
}

async function getTrackingProject(req, res, projectId, requireOwner = false) {
  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return null;
  }
  if (!allowed) {
    res.status(403).json({ error: 'You do not have access to this project.' });
    return null;
  }
  if (requireOwner && req.user.role !== 'Student') {
    res.status(403).json({ error: 'Only the project owner can manage tracking.' });
    return null;
  }

  return project;
}

router.get('/:id/tracking', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const project = await getTrackingProject(req, res, projectId);
  if (!project) return;

  const milestones = await query(
    `SELECT milestone_id, project_id, title, description, deadline, status, created_at, updated_at
       FROM milestones
      WHERE project_id = ?
      ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline, milestone_id`,
    [projectId]
  );
  const tasks = await query(
    `SELECT mt.task_id, mt.milestone_id, mt.title, mt.due_date, mt.status, mt.created_at, mt.updated_at
       FROM milestone_tasks mt
       JOIN milestones m ON m.milestone_id = mt.milestone_id
      WHERE m.project_id = ?
      ORDER BY CASE WHEN mt.due_date IS NULL THEN 1 ELSE 0 END, mt.due_date, mt.task_id`,
    [projectId]
  );
  const tasksByMilestone = new Map();
  for (const task of tasks) {
    const milestoneTasks = tasksByMilestone.get(task.milestone_id) || [];
    milestoneTasks.push(task);
    tasksByMilestone.set(task.milestone_id, milestoneTasks);
  }

  return res.json({
    project: normalizeProject(project),
    milestones: milestones.map((milestone) => {
      const milestoneTasks = tasksByMilestone.get(milestone.milestone_id) || [];
      const completeCount = milestoneTasks.filter((task) => task.status === 'Completed').length;
      const status = milestoneTasks.length
        ? (completeCount === milestoneTasks.length
          ? 'Completed'
          : (milestoneTasks.some((task) => task.status !== 'Not Started') || completeCount > 0
            ? 'In Progress'
            : 'Not Started'))
        : milestone.status;

      return {
        ...milestone,
        status,
        tasks: milestoneTasks
      };
    })
  });
});

router.post('/:id/milestones', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const { title, description, deadline } = req.body || {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanDescription = typeof description === 'string' ? description.trim() : '';
  const cleanDeadline = validDate(deadline);
  if (cleanTitle.length < 3 || cleanTitle.length > 160) {
    return res.status(400).json({ error: 'Milestone title must be between 3 and 160 characters.' });
  }
  if (cleanDescription.length > 2000) {
    return res.status(400).json({ error: 'Milestone description must be 2000 characters or fewer.' });
  }
  if (!cleanDeadline.valid) {
    return res.status(400).json({ error: 'Please provide a valid milestone deadline.' });
  }

  const result = await transaction(async (execute) => {
    const milestone = await execute(
      'INSERT INTO milestones (project_id, title, description, deadline) VALUES (?, ?, ?, ?)',
      [projectId, cleanTitle, cleanDescription || null, cleanDeadline.value]
    );
    if (cleanDeadline.value) {
      await notifyProjectParticipants(
        execute,
        projectId,
        `Deadline set for milestone "${cleanTitle}" on ${cleanDeadline.value}.`
      );
    }
    return milestone;
  });
  const rows = await query('SELECT * FROM milestones WHERE milestone_id = ? LIMIT 1', [result.insertId]);
  return res.status(201).json({ milestone: rows[0] });
});

router.put('/:id/milestones/:milestoneId', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  if (!projectId || !milestoneId) {
    return res.status(400).json({ error: 'Invalid project or milestone id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const milestoneRows = await query(
    'SELECT milestone_id, title, deadline FROM milestones WHERE milestone_id = ? AND project_id = ? LIMIT 1',
    [milestoneId, projectId]
  );
  if (milestoneRows.length === 0) {
    return res.status(404).json({ error: 'Milestone not found.' });
  }

  const { title, description, deadline, status } = req.body || {};
  const updates = [];
  const params = [];
  let deadlineNotification = null;
  if (title !== undefined) {
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (cleanTitle.length < 3 || cleanTitle.length > 160) {
      return res.status(400).json({ error: 'Milestone title must be between 3 and 160 characters.' });
    }
    updates.push('title = ?');
    params.push(cleanTitle);
  }
  if (description !== undefined) {
    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    if (cleanDescription.length > 2000) {
      return res.status(400).json({ error: 'Milestone description must be 2000 characters or fewer.' });
    }
    updates.push('description = ?');
    params.push(cleanDescription || null);
  }
  if (deadline !== undefined) {
    const cleanDeadline = validDate(deadline);
    if (!cleanDeadline.valid) {
      return res.status(400).json({ error: 'Please provide a valid milestone deadline.' });
    }
    updates.push('deadline = ?');
    params.push(cleanDeadline.value);
    if (cleanDeadline.value !== milestoneRows[0].deadline) {
      deadlineNotification = cleanDeadline.value
        ? `Deadline set for milestone "${title || milestoneRows[0].title}" on ${cleanDeadline.value}.`
        : `Deadline removed from milestone "${title || milestoneRows[0].title}".`;
    }
  }
  if (status !== undefined) {
    if (!['Not Started', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'This milestone status is not valid.' });
    }
    updates.push('status = ?');
    params.push(status);
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No milestone changes were supplied.' });
  }

  params.push(milestoneId, projectId);
  await transaction(async (execute) => {
    await execute(
      `UPDATE milestones SET ${updates.join(', ')} WHERE milestone_id = ? AND project_id = ?`,
      params
    );
    if (deadlineNotification) {
      await notifyProjectParticipants(execute, projectId, deadlineNotification);
    }
  });
  const rows = await query('SELECT * FROM milestones WHERE milestone_id = ? LIMIT 1', [milestoneId]);
  return res.json({ milestone: rows[0] });
});

router.delete('/:id/milestones/:milestoneId', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  if (!projectId || !milestoneId) {
    return res.status(400).json({ error: 'Invalid project or milestone id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const result = await query(
    'DELETE FROM milestones WHERE milestone_id = ? AND project_id = ?',
    [milestoneId, projectId]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Milestone not found.' });
  }

  return res.json({ deleted: true });
});

router.post('/:id/milestones/:milestoneId/tasks', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  if (!projectId || !milestoneId) {
    return res.status(400).json({ error: 'Invalid project or milestone id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const milestoneRows = await query(
    'SELECT milestone_id FROM milestones WHERE milestone_id = ? AND project_id = ? LIMIT 1',
    [milestoneId, projectId]
  );
  if (milestoneRows.length === 0) {
    return res.status(404).json({ error: 'Milestone not found.' });
  }

  const { title, dueDate } = req.body || {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanDueDate = validDate(dueDate);
  if (cleanTitle.length < 3 || cleanTitle.length > 160) {
    return res.status(400).json({ error: 'Task title must be between 3 and 160 characters.' });
  }
  if (!cleanDueDate.valid) {
    return res.status(400).json({ error: 'Please provide a valid task due date.' });
  }

  const result = await transaction(async (execute) => {
    const task = await execute(
      'INSERT INTO milestone_tasks (milestone_id, title, due_date) VALUES (?, ?, ?)',
      [milestoneId, cleanTitle, cleanDueDate.value]
    );
    if (cleanDueDate.value) {
      await notifyProjectParticipants(
        execute,
        projectId,
        `Deadline set for task "${cleanTitle}" on ${cleanDueDate.value}.`
      );
    }
    return task;
  });
  const rows = await query('SELECT * FROM milestone_tasks WHERE task_id = ? LIMIT 1', [result.insertId]);
  return res.status(201).json({ task: rows[0] });
});

router.put('/:id/milestones/:milestoneId/tasks/:taskId', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  const taskId = parseId(req.params.taskId);
  if (!projectId || !milestoneId || !taskId) {
    return res.status(400).json({ error: 'Invalid project, milestone, or task id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const taskRows = await query(
    `SELECT mt.task_id, mt.title, mt.due_date FROM milestone_tasks mt
       JOIN milestones m ON m.milestone_id = mt.milestone_id
      WHERE mt.task_id = ? AND mt.milestone_id = ? AND m.project_id = ?
      LIMIT 1`,
    [taskId, milestoneId, projectId]
  );
  if (taskRows.length === 0) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const { title, dueDate, status } = req.body || {};
  const updates = [];
  const params = [];
  let deadlineNotification = null;
  if (title !== undefined) {
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (cleanTitle.length < 3 || cleanTitle.length > 160) {
      return res.status(400).json({ error: 'Task title must be between 3 and 160 characters.' });
    }
    updates.push('title = ?');
    params.push(cleanTitle);
  }
  if (dueDate !== undefined) {
    const cleanDueDate = validDate(dueDate);
    if (!cleanDueDate.valid) {
      return res.status(400).json({ error: 'Please provide a valid task due date.' });
    }
    updates.push('due_date = ?');
    params.push(cleanDueDate.value);
    if (cleanDueDate.value !== taskRows[0].due_date) {
      deadlineNotification = cleanDueDate.value
        ? `Deadline set for task "${title || taskRows[0].title}" on ${cleanDueDate.value}.`
        : `Deadline removed from task "${title || taskRows[0].title}".`;
    }
  }
  if (status !== undefined) {
    if (!['Not Started', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'This task status is not valid.' });
    }
    updates.push('status = ?');
    params.push(status);
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No task changes were supplied.' });
  }

  params.push(taskId);
  await transaction(async (execute) => {
    await execute(`UPDATE milestone_tasks SET ${updates.join(', ')} WHERE task_id = ?`, params);
    if (deadlineNotification) {
      await notifyProjectParticipants(execute, projectId, deadlineNotification);
    }
  });
  const rows = await query('SELECT * FROM milestone_tasks WHERE task_id = ? LIMIT 1', [taskId]);
  return res.json({ task: rows[0] });
});

router.delete('/:id/milestones/:milestoneId/tasks/:taskId', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  const taskId = parseId(req.params.taskId);
  if (!projectId || !milestoneId || !taskId) {
    return res.status(400).json({ error: 'Invalid project, milestone, or task id.' });
  }

  const project = await getTrackingProject(req, res, projectId, true);
  if (!project) return;

  const result = await query(
    `DELETE FROM milestone_tasks
      WHERE task_id = ? AND milestone_id = ?
        AND milestone_id IN (SELECT milestone_id FROM milestones WHERE project_id = ?)`,
    [taskId, milestoneId, projectId]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  return res.json({ deleted: true });
});

router.get('/:id/comments', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this project.' });
  }

  const comments = await query(
    `SELECT c.comment_id, c.project_id, c.user_id, c.message, c.created_at,
            u.name AS author_name, u.role AS author_role
       FROM project_comments c
       JOIN users u ON u.user_id = c.user_id
      WHERE c.project_id = ?
      ORDER BY c.created_at DESC, c.comment_id DESC`,
    [projectId]
  );
  return res.json({
    comments: comments.map((comment) => ({
      commentId: comment.comment_id,
      projectId: comment.project_id,
      userId: comment.user_id,
      authorName: comment.author_name,
      authorRole: comment.author_role,
      message: comment.message,
      createdAt: comment.created_at
    }))
  });
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this project.' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 1 || message.length > 2000) {
    return res.status(400).json({ error: 'Comment must be between 1 and 2000 characters.' });
  }

  let recipientId = req.user.role === 'Teacher' ? project.student_id : null;
  if (req.user.role === 'Student' && project.section_id) {
    const teachers = await query(
      'SELECT teacher_id FROM sections WHERE section_id = ? LIMIT 1',
      [project.section_id]
    );
    recipientId = teachers[0]?.teacher_id || null;
  }

  const commentId = await transaction(async (execute) => {
    const result = await execute(
      'INSERT INTO project_comments (project_id, user_id, message) VALUES (?, ?, ?)',
      [projectId, req.user.id, message]
    );
    await createNotification(execute, {
      userId: recipientId,
      type: 'comment',
      message: `${req.user.name} commented on "${project.title}".`,
      projectId
    });
    return result.insertId;
  });
  const comments = await query(
    `SELECT c.comment_id, c.project_id, c.user_id, c.message, c.created_at,
            u.name AS author_name, u.role AS author_role
       FROM project_comments c
       JOIN users u ON u.user_id = c.user_id
      WHERE c.comment_id = ?
      LIMIT 1`,
    [commentId]
  );
  const comment = comments[0];
  return res.status(201).json({
    comment: {
      commentId: comment.comment_id,
      projectId: comment.project_id,
      userId: comment.user_id,
      authorName: comment.author_name,
      authorRole: comment.author_role,
      message: comment.message,
      createdAt: comment.created_at
    }
  });
});

router.get('/:id/reviews', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this project.' });
  }

  const reviews = await query(
    `SELECT r.review_id, r.project_id, r.teacher_id, r.decision, r.feedback, r.marks,
            r.rating, r.reviewed_at, u.name AS teacher_name
       FROM reviews r
       JOIN users u ON u.user_id = r.teacher_id
      WHERE r.project_id = ?
      ORDER BY r.reviewed_at DESC, r.review_id DESC`,
    [projectId]
  );
  return res.json({ reviews: reviews.map(normalizeReview) });
});

router.post('/:id/reviews', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this project.' });
  }
  if (req.user.role !== 'Teacher') {
    return res.status(403).json({ error: 'Only the assigned teacher can review this project.' });
  }
  if (project.status !== 'Submitted') {
    return res.status(409).json({ error: 'Only submitted projects can be reviewed.' });
  }

  const { decision, feedback, marks, rating } = req.body || {};
  const cleanFeedback = typeof feedback === 'string' ? feedback.trim() : '';
  if (!['Accepted', 'Changes Requested'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be Accepted or Changes Requested.' });
  }
  if (cleanFeedback.length < 1 || cleanFeedback.length > 5000) {
    return res.status(400).json({ error: 'Feedback must be between 1 and 5000 characters.' });
  }
  if (typeof marks !== 'number' || !Number.isFinite(marks) || marks < 0 || marks > 100 || Math.round(marks * 100) !== marks * 100) {
    return res.status(400).json({ error: 'Marks must be a number from 0 to 100 with at most two decimal places.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }

  const reviewId = await transaction(async (execute) => {
    const updated = await execute(
      'UPDATE projects SET status = ? WHERE project_id = ? AND status = ?',
      [decision, projectId, 'Submitted']
    );
    if (updated.affectedRows === 0) return null;

    const result = await execute(
      'INSERT INTO reviews (project_id, teacher_id, decision, feedback, marks, rating) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, req.user.id, decision, cleanFeedback, marks, rating]
    );
    await createNotification(execute, {
      userId: project.student_id,
      type: 'feedback',
      message: `New review feedback is available for "${project.title}".`,
      projectId
    });
    return result.insertId;
  });

  if (reviewId === null) {
    return res.status(409).json({ error: 'This project has already been reviewed.' });
  }

  const rows = await query(
    `SELECT r.review_id, r.project_id, r.teacher_id, r.decision, r.feedback, r.marks,
            r.rating, r.reviewed_at, u.name AS teacher_name
       FROM reviews r
       JOIN users u ON u.user_id = r.teacher_id
      WHERE r.review_id = ?
      LIMIT 1`,
    [reviewId]
  );
  return res.status(201).json({ review: normalizeReview(rows[0]) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this project.' });
  }

  const files = await query(
    'SELECT file_id, project_id, file_name, original_name, mime_type, file_size, file_path, uploaded_at FROM project_files WHERE project_id = ? ORDER BY uploaded_at DESC',
    [projectId]
  );

  return res.json({ project: normalizeProject(project), files });
});

router.put('/:id', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed || req.user.role !== 'Student') {
    return res.status(403).json({ error: 'Only the project owner can update this repository.' });
  }

  const { title, description, categoryId, visibility, status } = req.body || {};
  const updates = [];
  const params = [];
  const isEditingProject = title !== undefined
    || description !== undefined
    || categoryId !== undefined
    || visibility !== undefined;
  if (isEditingProject && !['Draft', 'In Progress', 'Changes Requested'].includes(project.status)) {
    return res.status(409).json({ error: 'Submitted or accepted projects cannot be edited.' });
  }

  if (typeof title === 'string') {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 160) {
      return res.status(400).json({ error: 'Project title must be between 3 and 160 characters.' });
    }
    updates.push('title = ?');
    params.push(cleanTitle);
  }

  if (typeof description === 'string') {
    const cleanDescription = description.trim();
    if (cleanDescription.length < 10 || cleanDescription.length > 5000) {
      return res.status(400).json({ error: 'Project description must be between 10 and 5000 characters.' });
    }
    updates.push('description = ?');
    params.push(cleanDescription);
  }

  if (categoryId !== undefined) {
    const cleanCategoryId = parseId(categoryId);
    if (!cleanCategoryId) {
      return res.status(400).json({ error: 'Please choose a valid category.' });
    }
    const categoryExists = await query('SELECT category_id FROM categories WHERE category_id = ? LIMIT 1', [cleanCategoryId]);
    if (categoryExists.length === 0) {
      return res.status(400).json({ error: 'The selected category does not exist.' });
    }
    updates.push('category_id = ?');
    params.push(cleanCategoryId);
  }

  if (visibility === 'Public' || visibility === 'Private') {
    updates.push('visibility = ?');
    params.push(visibility);
  }

  if (status !== undefined) {
    const nextStatuses = {
      Draft: 'In Progress',
      'In Progress': 'Submitted',
      'Changes Requested': 'In Progress'
    };
    if (status !== nextStatuses[project.status]) {
      return res.status(400).json({ error: 'Project status can only move to its next workflow stage.' });
    }
    updates.push('status = ?');
    params.push(status);

    if (status === 'Submitted') {
      updates.push('submitted_at = CURRENT_TIMESTAMP');
    }
    if (status === 'Archived' && project.archived_at === null) {
      updates.push('archived_at = CURRENT_TIMESTAMP');
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No project changes were supplied.' });
  }

  params.push(projectId);
  await transaction(async (execute) => {
    await execute(`UPDATE projects SET ${updates.join(', ')} WHERE project_id = ?`, params);
    if (status === 'Submitted' && project.section_id) {
      const sections = await execute(
        'SELECT teacher_id FROM sections WHERE section_id = ? LIMIT 1',
        [project.section_id]
      );
      if (sections.length > 0) {
        await createNotification(execute, {
          userId: sections[0].teacher_id,
          type: 'submission',
          message: `${project.studentName} submitted "${project.title}" for review.`,
          projectId
        });
      }
    }
  });

  const refreshed = await findProject(projectId);
  return res.json({ project: normalizeProject(refreshed) });
});

router.post('/:id/files', requireAuth, upload.array('files', 10), async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed || req.user.role !== 'Student') {
    return res.status(403).json({ error: 'Only the project owner can upload files.' });
  }
  if (!['Draft', 'In Progress', 'Changes Requested'].includes(project.status)) {
    return res.status(409).json({ error: 'Submitted or accepted projects cannot receive new files.' });
  }

  const uploadedFiles = req.files || [];
  if (uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'Please select at least one file to upload.' });
  }

  const inserts = uploadedFiles.map((file) => [
    projectId,
    file.filename,
    file.originalname,
    file.mimetype,
    file.size,
    path.join(uploadsDir, file.filename)
  ]);

  for (const insert of inserts) {
    await query(
      'INSERT INTO project_files (project_id, file_name, original_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?)',
      insert
    );
  }

  const files = await query(
    'SELECT file_id, project_id, file_name, original_name, mime_type, file_size, file_path, uploaded_at FROM project_files WHERE project_id = ? ORDER BY uploaded_at DESC',
    [projectId]
  );

  return res.status(201).json({ files });
});

router.get('/:id/files/:fileId', requireAuth, async (req, res) => {
  const projectId = parseId(req.params.id);
  const fileId = parseId(req.params.fileId);

  if (!projectId || !fileId) {
    return res.status(400).json({ error: 'Invalid project or file id.' });
  }

  const { project, allowed } = await userCanAccessProject(req.user, projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have access to this file.' });
  }

  const rows = await query(
    'SELECT file_id, project_id, original_name, file_path, mime_type FROM project_files WHERE file_id = ? AND project_id = ? LIMIT 1',
    [fileId, projectId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'File not found.' });
  }

  const file = rows[0];
  const absolutePath = file.file_path;
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'The file no longer exists on disk.' });
  }

  return res.download(absolutePath, file.original_name, { headers: { 'Content-Type': file.mime_type } });
});

module.exports = router;
