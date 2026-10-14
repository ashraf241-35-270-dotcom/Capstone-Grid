// controllers/donationController.js
const db = require('../config/db');
const sendEmail = require('../utils/email');

const createDonation = async (req, res) => {
    try {
        const donor_id = req.user.user_id; // from JWT
        const { food_name, description, quantity, food_type, expiry_time,
                pickup_address, latitude, longitude, image_url } = req.body;

        if (!food_name || !quantity || !expiry_time || !pickup_address) {
            return res.status(400).json({ message: 'food_name, quantity, expiry_time and pickup_address are required.' });
        }

        const [result] = await db.query(
            `INSERT INTO donations
             (donor_id, food_name, description, quantity, food_type, expiry_time, pickup_address, latitude, longitude, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [donor_id, food_name, description || null, quantity, food_type || 'veg',
             expiry_time, pickup_address, latitude || null, longitude || null, image_url || null]
        );

        res.status(201).json({ message: 'Donation added successfully.', donation_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while creating donation.' });
    }
};

const getMyDonations = async (req, res) => {
    try {
        const donor_id = req.user.user_id;
        const [rows] = await db.query(
            'SELECT * FROM donations WHERE donor_id = ? ORDER BY created_at DESC',
            [donor_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching donations.' });
    }
};
const getAvailableDonations = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT d.*, u.name AS donor_name, u.phone AS donor_phone
             FROM donations d
             JOIN users u ON d.donor_id = u.user_id
             WHERE d.status = 'available'
             ORDER BY d.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching available donations.' });
    }
};
const requestDonation = async (req, res) => {
    try {
        const receiver_id = req.user.user_id;
        const { donation_id } = req.body;

        const [donationRows] = await db.query('SELECT * FROM donations WHERE donation_id = ?', [donation_id]);
        if (donationRows.length === 0) {
            return res.status(404).json({ message: 'Donation not found.' });
        }
        if (donationRows[0].status !== 'available') {
            return res.status(400).json({ message: 'This food item is no longer available.' });
        }

        await db.query(
            'INSERT INTO requests (donation_id, receiver_id) VALUES (?, ?)',
            [donation_id, receiver_id]
        );

        await db.query('UPDATE donations SET status = "requested" WHERE donation_id = ?', [donation_id]);

        // notify donor by email
        const [[donor]] = await db.query(
            `SELECT u.email, u.name FROM users u
             JOIN donations d ON d.donor_id = u.user_id
             WHERE d.donation_id = ?`, [donation_id]
        );
        if (donor) {
            sendEmail(
                donor.email,
                'FoodBridge: New Request for Your Donation',
                `Hi ${donor.name}, a receiver has requested your food donation "${donationRows[0].food_name}". Please log in to FoodBridge to respond.`
            );
        }

        res.status(201).json({ message: 'Request submitted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while requesting donation.' });
    }
};

const updateDonationStatus = async (req, res) => {
    try {
        const { donation_id } = req.params;
        const { status } = req.body; // available | requested | delivered | expired
        const donor_id = req.user.user_id;

        const [rows] = await db.query('SELECT * FROM donations WHERE donation_id = ? AND donor_id = ?', [donation_id, donor_id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Donation not found or not owned by you.' });
        }

        await db.query('UPDATE donations SET status = ? WHERE donation_id = ?', [status, donation_id]);
        res.json({ message: 'Donation status updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while updating status.' });
    }
};

const getMyRequests = async (req, res) => {
    try {
        const receiver_id = req.user.user_id;
        const [rows] = await db.query(
            `SELECT r.*, d.food_name, d.quantity, d.pickup_address, d.status AS donation_status
             FROM requests r
             JOIN donations d ON r.donation_id = d.donation_id
             WHERE r.receiver_id = ?
             ORDER BY r.requested_at DESC`,
            [receiver_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while fetching requests.' });
    }
};

module.exports = {
    createDonation,
    getMyDonations,
    getAvailableDonations,
    requestDonation,
    updateDonationStatus,
    getMyRequests
};
