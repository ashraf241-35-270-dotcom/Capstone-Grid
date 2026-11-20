async function createNotification(execute, {
  userId,
  type,
  message,
  projectId = null,
  sectionId = null
}) {
  if (!userId) return;

  await execute(
    `INSERT INTO notifications (user_id, type, message, project_id, section_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, message, projectId, sectionId]
  );
}

async function notifyProjectParticipants(execute, projectId, message) {
  const rows = await execute(
    `SELECT p.student_id, s.teacher_id
       FROM projects p
       LEFT JOIN sections s ON s.section_id = p.section_id
      WHERE p.project_id = ?
      LIMIT 1`,
    [projectId]
  );
  if (rows.length === 0) return;

  const userIds = new Set([rows[0].student_id, rows[0].teacher_id].filter(Boolean).map(Number));
  for (const userId of userIds) {
    await createNotification(execute, {
      userId,
      type: 'deadline',
      message,
      projectId
    });
  }
}

module.exports = { createNotification, notifyProjectParticipants };
