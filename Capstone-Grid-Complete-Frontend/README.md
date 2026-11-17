# Capstone Grid – Complete Frontend (Module-wise)

## Included
- Public home page
- Separate Student login and registration
- Separate Teacher login and registration
- Student: dashboard, projects, create project, milestones/tasks, messages, profile
- Teacher: dashboard, sections, enrolled students, assigned projects, review, feedback/marks, messages, profile
- Shared: explore projects, archive, community posts/comments, notifications
- Responsive CSS and browser-side demo interactions

## Run
1. Extract the ZIP.
2. Open this folder in VS Code.
3. Use the Live Server extension and open `index.html`.
4. Register a Student or Teacher account, then log in using the same browser.
5. Demo content and form data are stored in browser localStorage.

## Important limitations
This is a frontend prototype only. Browser localStorage is used for demonstration. It is NOT secure authentication, does not provide real access control, and must not be used for production or real student data. Passwords in this demo are stored in localStorage only to demonstrate the flow. Remove this demo auth when connecting the backend.
Actual login/registration, password hashing, role authorization, private file upload/storage, database persistence, messaging, notifications and server-side validation must be implemented in Node.js + Express + MySQL. Never trust the role or user identity sent by the browser.
