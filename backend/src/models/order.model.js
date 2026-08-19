// Owner: Josh
// Purpose: Order schema — includes embedded items, supplies_used, and feedback.


// keep this bellow your schema (i need it and its good for our project) just after the scema definition, so we can index the collection for faster queries
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ branch_id: 1, createdAt: -1 });