import express from "express";
import { jobController } from "../controllers/jobController.js";

const router = express.Router();

router.post("/linkedin", jobController);

export default router;
