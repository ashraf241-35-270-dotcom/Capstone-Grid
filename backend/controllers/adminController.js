
const db = require('../config/db');

const getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT user_id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const { user_id } = req.params;
        const [rows] = await db.query('SELECT is_active FROM users WHERE user_id = ?', [user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const newStatus = !rows[0].is_active;
        await db.query('UPDATE users SET is_active = ? WHERE user_id = ?', [newStatus, user_id]);

        await db.query(
            'INSERT INTO admin_logs (admin_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
            [req.user.user_id, newStatus ? 'Activated user' : 'Deactivated user', 'users', user_id]
        );

        res.json({ message: `User has been ${newStatus ? 'activated' : 'deactivated'}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while updating user status.' });
    }
};

const getAllDonations = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT d.*, u.name AS donor_name, u.email AS donor_email
             FROM donations d
             JOIN users u ON d.donor_id = u.user_id
             ORDER BY d.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching donations.' });
    }
};

const deleteDonation = async (req, res) => {
    try {
        const { donation_id } = req.params;
        await db.query('DELETE FROM donations WHERE donation_id = ?', [donation_id]);

        await db.query(
            'INSERT INTO admin_logs (admin_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
            [req.user.user_id, 'Deleted donation', 'donations', donation_id]
        );

        res.json({ message: 'Donation deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while deleting donation.' });
    }
};

const getStats = async (req, res) => {
    try {
        const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');
        const [[{ totalDonors }]] = await db.query('SELECT COUNT(*) AS totalDonors FROM users WHERE role = "donor"');
        const [[{ totalReceivers }]] = await db.query('SELECT COUNT(*) AS totalReceivers FROM users WHERE role = "receiver"');
        const [[{ totalDonations }]] = await db.query('SELECT COUNT(*) AS totalDonations FROM donations');
        const [[{ delivered }]] = await db.query('SELECT COUNT(*) AS delivered FROM donations WHERE status = "delivered"');

        res.json({ totalUsers, totalDonors, totalReceivers, totalDonations, delivered });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching stats.' });
    }
};

module.exports = { getAllUsers, toggleUserStatus, getAllDonations, deleteDonation, getStats };
