import express from 'express';
import { Adding_New_User,file_handler,Get_Conversation_Messages, Getting_All_User } from '../Controllar/Controllar.js';
import Upload from '../middleware/multer.js';


const router = express.Router();

router.post('/user',Adding_New_User);
router.get('/All_users', Getting_All_User);
router.get('/Previous_conversation/:user1/:user2',Get_Conversation_Messages );
router.post('/upload',Upload.single("file"),file_handler );







export default router;