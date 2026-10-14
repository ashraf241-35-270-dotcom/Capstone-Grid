
const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/auth');
const {
    createDonation,
    getMyDonations,
    getAvailableDonations,
    requestDonation,
    updateDonationStatus,
    getMyRequests
} = require('../controllers/donationController');


router.post('/', verifyToken, allowRoles('donor'), createDonation);
router.get('/mine', verifyToken, allowRoles('donor'), getMyDonations);
router.put('/:donation_id/status', verifyToken, allowRoles('donor'), updateDonationStatus);


router.get('/available', verifyToken, allowRoles('receiver'), getAvailableDonations);
router.post('/request', verifyToken, allowRoles('receiver'), requestDonation);
router.get('/requests/mine', verifyToken, allowRoles('receiver'), getMyRequests);

module.exports = router;
