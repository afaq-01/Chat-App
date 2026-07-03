import express from 'express';
import { Adding_New_User,Get_Conversation_Messages, Getting_All_User } from '../Controllar/Controllar.js';


const router = express.Router();

router.post('/user', Adding_New_User);
router.get('/All_users', Getting_All_User);
router.get('/Previous_conversation/:user1/:user2',Get_Conversation_Messages );






export default router;