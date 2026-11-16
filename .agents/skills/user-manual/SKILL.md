---
name: user-manual
description: "This skill gives you the facts, procedure, and rules for creating a user manual, user guide, or standard operating procedure (SOP). It also tells you how to write clear instructions in Simplified Technical English (STE)."
---

# User Manual

This skill gives you the procedure, structure, and rules to write an effective user manual or user guide. It enforces Simplified Technical English (STE) so that instructions are clear, unambiguous, and easy for any user to follow.

## Workflow

1. **Find the task type.** The user wants one of these:
   - A complete user manual for a product, application, or system.
   - A quick start guide or onboarding document.
   - A standard operating procedure (SOP) or single task guide.
   - A troubleshooting guide or reference section.
   - A review or rewrite of an existing manual into STE.
   - An explanation or outline of a manual structure.
2. **Get the inputs.** Use the **Inputs** list in this skill. If the user provided enough information, proceed. If key information is missing, state your assumptions in one line, or ask one targeted question. Do not ask more than one question at a time.
3. **Determine the target audience and skill level.** Identify whether the reader is a novice end-user, system administrator, operator, or technician. Adjust technical terminology and prerequisite assumptions to match.
4. **Organize the procedures into logical sequence.** Arrange tasks chronologically:
   - Prerequisites and requirements.
   - Initial setup or installation.
   - Primary daily tasks (main workflows).
   - Secondary or administrative tasks.
   - Maintenance, troubleshooting, and error recovery.
5. **Write the manual in Simplified Technical English (STE).** Apply the STE rules:
   - Use the imperative mood for steps ("Click **Save**.", not "The user should click Save.").
   - Write one action per sentence.
   - Keep instructions under 20 words.
   - State the condition before the action ("If the indicator light is red, press **Reset**.").
   - Follow the Action-Result pattern for each key step.
6. **Add safety notices, warnings, and cautions.** Place warnings and cautions immediately *before* the step that creates the risk, never after.
7. **Perform the final check.** Complete the verification checklist at the end of this skill.

## Output formats

**Explanation or Outline (chat).** State the target audience and purpose in one or two sentences. Provide the proposed table of contents or outline. Highlight required inputs or missing sections briefly.

**Full User Manual.** Write a Markdown document (`.md`). Include these standard sections:
1. Title and Document Control (System name, version, date, target audience).
2. Overview and Purpose (What the system does in simple terms).
3. System Requirements and Prerequisites (Hardware, software, accounts, access rights).
4. Getting Started (Setup, installation, initial login).
5. Step-by-Step Procedures (Numbered instructions with expected results).
6. Troubleshooting and Error Messages (Problem, cause, solution table).
7. Support and Glossary (Contact information and term definitions).

**Quick Start Guide.** Write a concise 1-page to 2-page Markdown document focusing only on the path to first success:
1. What You Need (Prerequisites list).
2. 3 to 5 setup steps.
3. First task execution (Verifying it works).
4. Next steps / Where to find help.

**Task Procedure / SOP.** Write a single focused procedure:
1. Task Name (Action verb + Object, for example: "Export Monthly Sales Report").
2. Purpose and Scope.
3. Prerequisites (Required roles, permissions, open screens).
4. Step-by-Step Instructions (Numbered steps in imperative voice).
5. Verification / Expected Result (How the user knows the task succeeded).

**Review and Rewrite into STE.** 
1. List each issue found (passive voice, long sentence, missing prerequisite, ambiguity, synonym confusion, misplaced warning).
2. Provide the rewritten text in clean STE.
3. Provide a side-by-side or before-and-after comparison of key steps.

---

## STE writing rules

Apply these rules to all user manual text. They follow the core principles of ASD-STE100. They make technical text easy to understand, especially for non-native English speakers and automated translation tools.

### Sentences
1. **Instruction sentence limit:** Write procedure sentences with 20 words or fewer.
2. **Descriptive sentence limit:** Write descriptive or explanatory sentences with 25 words or fewer.
3. **One instruction per sentence:** Give only one command in each numbered step or sentence. Do not combine actions with "and" (for example, write: "1. Click **File**. 2. Click **Save**.", not "Click File and then click Save.").
4. **Condition before action:** Put a condition or prerequisite at the start of the sentence.
   - Correct: "If the red light blinks, turn off the switch."
   - Incorrect: "Turn off the switch if the red light blinks."
5. **Paragraph limit:** Limit each explanatory paragraph to a maximum of six sentences.
6. **Lists:** Use numbered lists for sequential steps. Use bulleted lists for non-sequential items, options, or lists of three or more items.

### Words and Vocabulary
7. **One word, one meaning:** Use the same word for the same concept across the entire document. Never use synonyms for variety.
   - Pick one verb and stick to it: use *select* (do not switch between *choose*, *pick*, and *select*); use *click* for a mouse click; use *tap* for a touch screen; use *press* for a physical button or key.
8. **Approved simple verbs:**
   - Use *use* (not *utilize*).
   - Use *start* (not *initiate* or *commence*).
   - Use *show* or *display* (not *illustrate*).
   - Use *make sure* (not *ensure* or *verify*).
   - Use *stop* (not *terminate* or *abort*).
   - Use *change* (not *modify*).
   - Use *do* (not *execute* or *implement*).
9. **No phrasal verbs or idioms:** Avoid two-word verbs where a single clear verb exists.
   - Write *connect* (not *hook up*).
   - Write *remove* (not *take out*).
   - Write *install* or *configure* (not *set up*).
   - Write *start* (not *boot up*).
   - Write *examine* (not *check out*).
10. **Do not omit articles:** Keep articles (*a*, *an*, *the*) in place. Do not write headline-style shorthand.
    - Correct: "Insert the cable into the port."
    - Incorrect: "Insert cable into port."
11. **No contractions:** Do not use contractions. Write "do not" (not "don't"), "cannot" (not "can't"), "is not" (not "isn't").
12. **No Latin abbreviations:** Do not use "e.g.", "i.e.", or "etc.". Write "for example", "that is", or list all applicable items explicitly.
13. **Noun clusters:** Limit noun clusters (strings of consecutive nouns) to three words or fewer. Use *of* or *for* to separate longer noun chains.
    - Correct: "Storage capacity of the backup server"
    - Incorrect: "Backup server storage capacity limit"
14. **Abbreviations and acronyms:** Spell out each abbreviation or acronym the first time it appears, followed by the abbreviation in parentheses (for example: "Standard Operating Procedure (SOP)").

### Grammar and Voice
15. **Active voice only:** Always use active voice. Identify who or what performs the action.
    - Correct: "The administrator approves the request."
    - Incorrect: "The request is approved by the administrator."
16. **Imperative mood for instructions:** Start every procedural step with an imperative verb.
    - Correct: "Click **Submit**."
    - Incorrect: "You should click Submit." / "Clicking Submit will submit the form."
17. **Tense usage:**
    - Use the simple present tense for facts, descriptions, and system behavior ("The dialog box closes.").
    - Use the imperative mood for instructions ("Enter your password.").
    - Use "will" only to describe an automatic system response that occurs after a delay or in a future step.
18. **Avoid gerunds and participles:** Do not use *-ing* words as verbs. Use *-ing* only when part of a recognized technical noun (for example, "Operating System").
    - Correct: "To clean the filter, do these steps:"
    - Incorrect: "Before cleaning the filter..."
19. **Modal verbs:**
    - Use *must* for mandatory rules or requirements.
    - Use *can* for capability or optional user actions.
    - Use *should* only for recommended best practices.
    - Do not use *may* (it is ambiguous between permission and probability).

### Safety and Callouts
20. **Callout placement:** Always place a WARNING, CAUTION, or NOTE *before* the step it describes, never after.
21. **Standard callout levels:**
    - **WARNING:** Alerts the user to conditions that can cause personal injury or death.
    - **CAUTION:** Alerts the user to conditions that can cause data loss, file corruption, or hardware damage.
    - **NOTE:** Provides important contextual information or a tip to prevent user confusion.
22. **Format of callouts:** State the risk, the cause, and the prevention in clear, direct sentences.

---

## User Interface (UI) formatting rules

When documenting software interfaces, follow these standard formatting conventions:

| Element | Format | Example |
|---|---|---|
| Buttons and links | Bold | Click **Save**. |
| Menus and paths | Bold with `>` separator | Select **File > Export > PDF**. |
| Text fields and inputs | Bold with explicit user entry in quotes or code | In the **Username** field, enter `admin`. |
| Checkboxes and radio buttons | Bold label with action | Select the **Remember me** checkbox. |
| Keyboard keys | Bold or `<kbd>` tags | Press **Enter** or press `<kbd>Ctrl</kbd> + <kbd>S</kbd>`. |
| Window / Screen / Tab names | Initial capital letters in bold | On the **Account Settings** page... |
| System messages | Code or italics | The message `Upload completed successfully` appears. |

---

## Structure of a standard User Manual

Use this structural blueprint when generating a full user manual:

### 1. Document Control
- Document Title (e.g., "User Manual: [Product Name]")
- Version / Release / Date
- Target Audience

### 2. Overview
- Product Purpose (1-3 sentences stating what the product does and who uses it).
- Key Capabilities (Bulleted list of primary functions).
- Conventions Used (Brief legend explaining **Bold** for UI items, Warnings, Cautions).

### 3. Prerequisites & System Requirements
- Hardware / Operating System requirements.
- Required software, browsers, or network access.
- User permissions, roles, or license requirements.

### 4. Getting Started
- Installation or Access URL.
- First-time setup / Account creation / Initial login.
- Interface Tour (Overview of the primary screen, navigation bar, and main workspace).

### 5. Step-by-Step Procedures (Core Tasks)
Organize procedures by task or user workflow (not by menu layout). For each task, provide:
- **Title:** Action verb + task name (e.g., "Create a New Project").
- **Purpose / Description:** One sentence explaining the task goal.
- **Prerequisites:** What must be open or completed before starting.
- **Steps:** Numbered steps starting with imperative verbs.
- **Expected Result:** What appears on screen when the task is complete.

Example Procedure in STE:
```markdown
### Create a New Customer Record

Use this procedure to add a new customer to the database.

**Prerequisites:**
- You must have the Sales Representative role.
- Open the **Customers** dashboard.

**Steps:**
1. Click **New Customer**.
   The **Customer Details** form appears.
2. In the **Company Name** field, enter the full legal name of the company.
3. In the **Email** field, enter the primary contact email address.
4. From the **Region** drop-down menu, select the customer territory.
5. Click **Save**.

**Result:**
The system saves the customer record. The new record appears in the **Customer List**.
```

### 6. Troubleshooting & Error Messages
Provide troubleshooting solutions in a clear table:

| Problem / Error Message | Possible Cause | Corrective Action |
|---|---|---|
| "Connection timed out" | The network connection is inactive. | 1. Check your network cable or Wi-Fi.<br>2. Click **Retry**. |
| Cannot save project | Required fields are empty. | 1. Fill in all fields marked with a red asterisk (*).<br>2. Click **Save**. |

### 7. Support & Maintenance
- Routine maintenance (clearing cache, updates, backups).
- Contact details for technical support (email, phone, ticketing portal).
- Glossary of technical terms (if acronyms or domain-specific words are used).

---

## Inputs

When the user asks for a user manual or guide, collect these inputs:
- **Product / System Name:** The official name and version of the product.
- **Target Audience:** Who will read the manual (end-user, operator, admin, beginner, advanced).
- **Scope / Feature List:** What tasks, modules, or features the manual covers.
- **Prerequisites:** Hardware, software, permissions, or existing accounts needed.
- **Workflows / Step Details:** The raw steps, notes, or screens involved in each procedure.
- **Known Errors / Gotchas:** Frequent failure points, error messages, and safety risks.

If the user gives incomplete details, do not stall. State reasonable assumptions in one sentence and deliver a clean draft with clear placeholders (e.g. `[Enter your server IP]`).

---

## Final check

Complete this verification checklist before delivering any user manual or procedure:

1. **STE Sentence Length:** Are procedure sentences 20 words or fewer, and explanations 25 words or fewer?
2. **One Action per Step:** Does each numbered step contain only one instruction?
3. **Imperative Mood:** Does every step begin with an action verb in the imperative mood?
4. **Condition First:** Are conditions placed at the start of sentences ("If X, do Y")?
5. **UI Consistency:** Are UI elements (buttons, menus, fields) styled consistently using bold text?
6. **Chronological Order:** Are the steps ordered strictly in chronological sequence?
7. **Expected Results:** Does the procedure specify what happens after key actions so the user knows it succeeded?
8. **Callout Placement:** Are all WARNING, CAUTION, and NOTE callouts placed *before* the relevant step?
9. **Active Voice:** Is the text free from passive voice and unnecessary gerunds (*-ing* verbs)?
10. **Terminology Consistency:** Is the exact same term used for the same concept throughout the document?
