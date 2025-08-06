// routes/productRoutes.js
import { protect, isAdmin } from '../middleware/auth.js';

router.post('/', protect, isAdmin, createProduct);
