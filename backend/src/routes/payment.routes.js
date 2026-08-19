// Owner:Series
// Purpose: /api/v1/payments routes.


import express from 'express';
import { initializePayment, makePayment,getPaymentByOrder,listPayments } from '../controllers/payment.controller.js';


const router = express.Router();

router.post('/initialize', initializePayment);
router.post('/', makePayment);
router.get('/order/:orderId', getPaymentByOrder);
router.get('/', listPayments);

export default router;