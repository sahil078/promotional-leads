const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

// POST - Create a new lead
router.post('/promotional-leads', leadController.createLead);

// GET - Retrieve all leads with optional filtering
router.get('/promotional-leads', leadController.getLeads);

module.exports = router;