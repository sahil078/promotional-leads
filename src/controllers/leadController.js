const supabase = require('../config/supabase');

const leadController = {
    // POST - Create a new lead with notes
    async createLead(req, res) {
        try {
            const {
                first_name,
                last_name,
                phone,
                other_phone,
                whatsapp,
                store_name,
                store_id,
                store_location,
                date_created,
                lead_source_name,
                lead_source_id,
                notes // This is now a string
            } = req.body;
    
            // Combine first and last name for the existing 'name' column
            const name = `${first_name || ''} ${last_name || ''}`.trim();
    
            // Process notes - convert to string if array, or keep as string
            let notesString = '';
            
            if (notes) {
                if (typeof notes === 'string') {
                    notesString = notes.trim();
                } else if (Array.isArray(notes)) {
                    // Convert array to string (comma-separated or any format you prefer)
                    notesString = notes
                        .filter(note => typeof note === 'string' && note.trim().length > 0)
                        .map(note => note.trim())
                        .join(', '); // or use '\n' for new lines
                }
            }
    
            // First, handle lead source (upsert)
            let leadSourceId = lead_source_id;
            
            if (lead_source_name) {
                const { data: sourceData, error: sourceError } = await supabase
                    .from('lead_sources')
                    .upsert(
                        { id: lead_source_id, name: lead_source_name },
                        { onConflict: 'id', ignoreDuplicates: false }
                    )
                    .select()
                    .single();
    
                if (sourceError && sourceError.code !== '23505') {
                    console.error('Lead source error:', sourceError);
                }
                
                if (sourceData) {
                    leadSourceId = sourceData.id;
                }
            }
    
            // Insert the main lead with notes in the leads table
            const { data: leadData, error: leadError } = await supabase
                .from('leads')
                .insert({
                    name,
                    first_name,
                    last_name,
                    phone,
                    other_phone,
                    whatsapp,
                    store_name,
                    store_id,
                    store_location,
                    date_created: date_created ? new Date(date_created) : new Date(),
                    lead_source_id: leadSourceId,
                    notes: notesString // Store notes directly in leads table
                })
                .select()
                .single();
    
            if (leadError) {
                console.error('Lead insertion error:', leadError);
                return res.status(400).json({ error: leadError.message });
            }
    
            res.status(201).json({
                message: 'Lead created successfully',
                lead: leadData
            });
    
        } catch (error) {
            console.error('Unexpected error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    
    // GET - Retrieve leads with optional filtering
    async getLeads(req, res) {
        try {
            const { store_id, lead_source_id, page = 1, limit = 10 } = req.query;
            
            let query = supabase
                .from('leads')
                .select('*', { count: 'exact' })
                .order('date_created', { ascending: false });

            // Apply filters if provided
            if (store_id) {
                query = query.eq('store_id', store_id);
            }

            if (lead_source_id) {
                query = query.eq('lead_source_id', lead_source_id);
            }

            // Pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data: leads, error, count } = await query.range(from, to);

            if (error) {
                console.error('Error fetching leads:', error);
                return res.status(400).json({ error: error.message });
            }

            res.json({
                leads,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            });

        } catch (error) {
            console.error('Unexpected error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // GET - Retrieve leads by a specific date
    async getLeadsByDate(req, res) {
        try {
            const { date } = req.params;

            // Validate the date format
            const parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
            }

            // Query leads for the specific date
            const { data: leads, error } = await supabase
                .from('leads')
                .select('*')
                .eq('date_created', parsedDate.toISOString().split('T')[0]);

            if (error) {
                console.error('Error fetching leads by date:', error);
                return res.status(400).json({ error: error.message });
            }

            res.json({ leads });

        } catch (error) {
            console.error('Unexpected error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

};

module.exports = leadController;