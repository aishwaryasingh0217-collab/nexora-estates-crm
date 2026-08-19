const express = require('express');
const router = express.Router();
const { getCustomers, getCustomerById, createCustomer, updateCustomer } = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createCustomer);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateCustomer);

module.exports = router;
