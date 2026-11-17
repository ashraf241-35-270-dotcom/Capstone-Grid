
const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/auth');
const {
    getAllUsers,
    toggleUserStatus,
    getAllDonations,
    deleteDonation,
    getStats
} = require('../controllers/adminController');

router.use(verifyToken, allowRoles('admin')); // every route below requires admin role

router.get('/users', getAllUsers);
router.put('/users/:user_id/toggle', toggleUserStatus);
router.get('/donations', getAllDonations);
router.delete('/donations/:donation_id', deleteDonation);
router.get('/stats', getStats);

module.exports = router;
