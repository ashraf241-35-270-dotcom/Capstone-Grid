const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.DB_FILE = path.join(os.tmpdir(), `capstone-grid-uploads-${process.pid}.sqlite`);
process.env.JWT_SECRET = 'test-only-project-upload-secret';

const databasePath = process.env.DB_FILE;
fs.rmSync(databasePath, { force: true });

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const config = require('../src/config');
const { closePool, initSchema, query } = require('../src/db');
const projectRoutes = require('../src/routes/projects');
const notificationRoutes = require('../src/routes/notifications');

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes);

let studentId;
let teacherId;
let projectId;
let sectionId;
let otherProjectId;
let otherSectionId;
let studentToken;
let teacherToken;
let otherTeacherToken;

describe('project file uploads', () => {
  beforeAll(async () => {
    await initSchema();
    const departments = await query(
      "SELECT department_id FROM departments WHERE name = 'Computer Science and Engineering' LIMIT 1"
    );
    const categories = await query('SELECT category_id FROM categories ORDER BY category_id LIMIT 1');
    const course = await query(
      'INSERT INTO courses (department_id, course_code, title) VALUES (?, ?, ?)',
      [departments[0].department_id, 'UPLOAD-TEST', 'Upload Test Course']
    );
    const student = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Upload Test Student', 'upload-student@example.test', 'test-hash', 'Student']
    );
    const teacher = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Upload Test Teacher', 'upload-teacher@example.test', 'test-hash', 'Teacher']
    );
    const otherTeacher = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Other Test Teacher', 'other-teacher@example.test', 'test-hash', 'Teacher']
    );
    const section = await query(
      'INSERT INTO sections (course_id, teacher_id, section_name, semester) VALUES (?, ?, ?, ?)',
      [course.insertId, teacher.insertId, 'UPLOAD-01', 'TEST']
    );
    const otherSection = await query(
      'INSERT INTO sections (course_id, teacher_id, section_name, semester) VALUES (?, ?, ?, ?)',
      [course.insertId, teacher.insertId, 'UPLOAD-02', 'TEST']
    );
    const project = await query(
      `INSERT INTO projects (student_id, section_id, category_id, title, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        student.insertId,
        section.insertId,
        categories[0].category_id,
        'Upload Notification Project',
        'Temporary integration-test project.',
        'In Progress'
      ]
    );
    const otherProject = await query(
      `INSERT INTO projects (student_id, section_id, category_id, title, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        student.insertId,
        otherSection.insertId,
        categories[0].category_id,
        'Other Section Project',
        'Temporary project used to verify section filtering.',
        'Draft'
      ]
    );

    studentId = student.insertId;
    teacherId = teacher.insertId;
    projectId = project.insertId;
    sectionId = section.insertId;
    otherProjectId = otherProject.insertId;
    otherSectionId = otherSection.insertId;
    studentToken = jwt.sign(
      { id: studentId, role: 'Student', name: 'Upload Test Student' },
      config.jwtSecret
    );
    teacherToken = jwt.sign(
      { id: teacherId, role: 'Teacher', name: 'Upload Test Teacher' },
      config.jwtSecret
    );
    otherTeacherToken = jwt.sign(
      { id: otherTeacher.insertId, role: 'Teacher', name: 'Other Test Teacher' },
      config.jwtSecret
    );
    await query(
      'INSERT INTO reviews (project_id, teacher_id, decision, feedback, marks, rating) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, teacherId, 'Changes Requested', 'First review.', 70, 3]
    );
    await query(
      'INSERT INTO reviews (project_id, teacher_id, decision, feedback, marks, rating) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, teacherId, 'Accepted', 'Latest review.', 92.5, 5]
    );
  });

  afterAll(async () => {
    const files = await query(
      'SELECT file_path FROM project_files WHERE project_id = ?',
      [projectId]
    );
    await Promise.all(files.map((file) => fs.promises.rm(file.file_path, { force: true })));
    await closePool();
    await fs.promises.rm(databasePath, { force: true });
    await fs.promises.rm(`${databasePath}-journal`, { force: true });
  });

  test('shows uploaded files to both participants and alerts the assigned teacher', async () => {
    const upload = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('files', Buffer.from('new report contents'), {
        filename: 'progress-report.txt',
        contentType: 'text/plain'
      })
      .expect(201);

    expect(upload.body.files).toHaveLength(1);
    expect(upload.body.files[0]).toMatchObject({
      name: 'progress-report.txt',
      mimeType: 'text/plain'
    });
    expect(upload.body.files[0]).not.toHaveProperty('file_path');

    const studentProjects = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(studentProjects.body.projects[0]).toMatchObject({
      files: [{ name: 'progress-report.txt' }],
      reviewSummary: { marks: 92.5, rating: 5 }
    });

    const teacherProjects = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(teacherProjects.body.projects[0].files[0]).toMatchObject({
      name: 'progress-report.txt',
      downloadUrl: `/projects/${projectId}/files/${upload.body.files[0].fileId}`
    });
    expect(teacherProjects.body.projects[0].reviewSummary).toEqual({ marks: 92.5, rating: 5 });

    const teacherNotifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(teacherNotifications.body.unreadCount).toBe(1);
    expect(teacherNotifications.body.notifications[0]).toMatchObject({
      type: 'submission',
      projectId,
      isRead: false,
      message: expect.stringContaining('progress-report.txt')
    });

    const studentNotifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(studentNotifications.body.unreadCount).toBe(0);

    await query(
      "UPDATE projects SET visibility = 'Public', status = 'Accepted' WHERE project_id = ?",
      [projectId]
    );
    const publicProjects = await request(app)
      .get('/api/projects/explore')
      .expect(200);
    expect(publicProjects.body.projects[0]).toMatchObject({
      projectId,
      reviewSummary: { marks: 92.5, rating: 5 }
    });

    await request(app)
      .get(`/api${upload.body.files[0].downloadUrl}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
  });

  test('returns clear errors for unsupported file types', async () => {
    const upload = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('files', Buffer.from('not allowed'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream'
      })
      .expect(400);

    expect(upload.body.error).toContain('Unsupported file type');
  });

  test('filters teacher projects by an owned section', async () => {
    const firstSection = await request(app)
      .get(`/api/projects?sectionId=${sectionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(firstSection.body.projects.map((project) => project.projectId)).toEqual([projectId]);

    const secondSection = await request(app)
      .get(`/api/projects?sectionId=${otherSectionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(secondSection.body.projects.map((project) => project.projectId)).toEqual([otherProjectId]);

    await request(app)
      .get('/api/projects?sectionId=invalid')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(400);

    await request(app)
      .get(`/api/projects?sectionId=${sectionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    await request(app)
      .get(`/api/projects?sectionId=${sectionId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);
  });

  test('lets the assigned teacher update marks and feedback while preserving review history', async () => {
    const beforeUpdate = await request(app)
      .get(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const latestReviewId = beforeUpdate.body.reviews[0].reviewId;

    await request(app)
      .post(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({
        decision: 'Accepted',
        feedback: 'Unauthorized update.',
        marks: 1,
        rating: 1
      })
      .expect(403);

    const update = await request(app)
      .post(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        decision: 'Accepted',
        feedback: 'Updated final feedback.',
        marks: 96.25,
        rating: 5
      })
      .expect(200);
    expect(update.body.review).toMatchObject({
      reviewId: latestReviewId,
      decision: 'Accepted',
      feedback: 'Updated final feedback.',
      marks: 96.25,
      rating: 5
    });

    const history = await request(app)
      .get(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(history.body.reviews).toHaveLength(2);
    expect(history.body.reviews[0]).toMatchObject({
      reviewId: latestReviewId,
      feedback: 'Updated final feedback.',
      marks: 96.25
    });
    expect(history.body.reviews[1].feedback).toBe('First review.');

    await request(app)
      .post(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        decision: 'Accepted',
        feedback: 'Updated again.',
        marks: 97,
        rating: 5
      })
      .expect(200);

    const updatedHistory = await request(app)
      .get(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(updatedHistory.body.reviews).toHaveLength(2);
    expect(updatedHistory.body.reviews[0]).toMatchObject({
      reviewId: latestReviewId,
      feedback: 'Updated again.',
      marks: 97
    });

    await request(app)
      .post(`/api/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        decision: 'Changes Requested',
        feedback: 'This cannot change the prior decision.',
        marks: 90,
        rating: 4
      })
      .expect(409);
  });
});
