import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

/**
 * POST /api/jobs/linkedin
 * body: { skills: ["Python","React"] }
 * returns: { jobs: [ { title, company, link, skills } ] }
 */
export const jobController = async (req, res) => {
  try {
    const skills = Array.isArray(req.body.skills) ? req.body.skills.join(" ") : (req.body.skills || "software engineer");
    const query = encodeURIComponent(skills);

    const url = `https://jsearch.p.rapidapi.com/search?query=${query}&page=1&num_pages=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
      }
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("RapidAPI error:", txt);
      return res.status(500).json({ error: "Job API error", details: txt });
    }

    const payload = await response.json();
    const data = payload.data || [];

    // map to simplified job objects
    const jobs = data.map(j => ({
      title: j.job_title || j.title,
      company: j.employer_name || j.employer,
      link: j.job_apply_link || j.job_link || j.job_post_url || j.url,
      skills: j.job_highlights || []
    }));

    res.json({ jobs });
  } catch (err) {
    console.error("jobController error:", err);
    res.status(500).json({ error: "Failed to fetch jobs", details: err.message });
  }
};
