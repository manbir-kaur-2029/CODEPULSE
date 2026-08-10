Here's the README FLE

*CodePulse* — Human-contribution diagnostic for hackathon judges

1. Why this needed building — I feel it takes a lot of manual work for judges of the hackathons, recruiters, boot camp organizers, hiring managers, etc., to actual identify if a project has been completely AI-generated or if it has some human contribution to it as well. Here's a problem-solver for it- codepulse :) 

2. What it does- Basically you just have to paste repo link + code sample + commit count → get a 0–100 score, a verdict, and a labeled breakdown of which signals fired and why.

3. How it works — It basically has six checks in it:

Conversational AI residue-leftover artifacts from copy-pasting straight out of a chatbot response without cleanup — things like:

Markdown code fences (```) left inside a .js/.py file
Phrases like "Here's the code:", "Sure, here you go", "I hope this helps", "As an AI language model"
Placeholder comments like // TODO: implement this sitting in otherwise "finished-looking" code
Inline explanatory prose that reads like chat output, not a code comment (e.g. "This function will now handle the edge case you mentioned")

Comment density- if it has excessively generated comments like an AI does when we code using it or basically no comment at all. A human presence would denote a balanced number.

Commit cadence-Commit cadence — a higher number of small, incremental commits suggests iterative work (writing, testing, fixing, refining over time), which is a stronger signal of active development than a single large commit dumping a finished file. Though its true that a low commit count doesn't prove AI use, but it removes a signal that would otherwise support genuine iteration.

Formatting variance- if the code is heavily formatted  or it has some uneven formatting and distortion in the number or amount of gaps, while writing the code too 

Structural repetition- if the project has some repeated chunk of code, which is done by AI commonly. AI-generated code often produces near-duplicate blocks with minor variable-name changes

4. Tech stack- Node.js, Express, vanilla HTML/CSS/JS frontend, deployed on Zerops.

5. How Zerops is used- single Node.js service, `zerops.yaml` drives build/deploy, auto-deploys on push to `main`. I actually debugged the hostname casing, the `compress`/`compression` typo in this section, which took a lot of time. I took help of AI like debugger.ai in it.

6. LIVE LINK TO THE PROJECT:  https://nodejs-2eb1-3000.prg1.zerops.app 
GITHUB REPOSITRY:  https://github.com/manbir-kaur-2029/CODEPULSE.git
LINKEDIN POST:  https://www.linkedin.com/posts/manbir-kaur-dev_codepulse-zeropschallenge-techinnovation-ugcPost-7492456104350855168-0B_c/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAE-Uvl0BXyMlOuEXpHHwFq2gFPlKqzpouAc  

7. Limitations— it's a helper tool, not the proof itself. Careful human coders may score "suspicious". It still needs lot more improvement to actually judge accuracy of "how much" human contribution is there in the project but I feel it can at least give us idea about this much at the moment, if the code is completely AI-generated or has some human contribution in it. 

8. AI tools used— Claude, google.ai, debugger AI tools like debugger.ai

9. Setup instructions — `npm install`, `npm start`

