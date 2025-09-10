const supabase = require('../config/supabase');

const leadController = {
    // POST - Create a new lead with notes
    async createLead(req, res) {
        try {
            const {
                name,
                phone,
                other_phone,
                telephone,
                store_name,
                store_id,
                store_location,
                date_created,
                lead_source_name,
                lead_source_id,
                ...notesData
            } = req.body;

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

                if (sourceError && sourceError.code !== '23505') { // Ignore duplicate key errors
                    console.error('Lead source error:', sourceError);
                }
                
                if (sourceData) {
                    leadSourceId = sourceData.id;
                }
            }

            // Insert the main lead
            const { data: leadData, error: leadError } = await supabase
                .from('leads')
                .insert({
                    name,
                    phone,
                    other_phone,
                    telephone,
                    store_name,
                    store_id,
                    store_location,
                    date_created: date_created ? new Date(date_created) : new Date(),
                    lead_source_id: leadSourceId
                })
                .select()
                .single();

            if (leadError) {
                console.error('Lead insertion error:', leadError);
                return res.status(400).json({ error: leadError.message });
            }

            // Process notes if they exist
            if (Object.keys(notesData).length > 0) {
                const notes = Object.values(notesData).filter(note => 
                    note && note.notetitle && note.note && note.noteid
                );

                if (notes.length > 0) {
                    const notesToInsert = notes.map(note => ({
                        lead_id: leadData.id,
                        notetitle: note.notetitle,
                        note: note.note,
                        noteid: note.noteid
                    }));

                    const { error: notesError } = await supabase
                        .from('lead_notes')
                        .insert(notesToInsert);

                    if (notesError) {
                        console.error('Notes insertion error:', notesError);
                        // We don't return error here since the lead was created successfully
                    }
                }
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
                .select(`
                    *,
                    lead_sources (*),
                    lead_notes (*)
                `)
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

    // GET - Retrieve a specific lead by ID
    async getLeadById(req, res) {
        try {
            const { id } = req.params;

            const { data: lead, error } = await supabase
                .from('leads')
                .select(`
                    *,
                    lead_sources (*),
                    lead_notes (*)
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching lead:', error);
                return res.status(404).json({ error: 'Lead not found' });
            }

            res.json(lead);

        } catch (error) {
            console.error('Unexpected error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = leadController;