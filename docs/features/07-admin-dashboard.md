# Admin Dashboard (Command Center)

The Admin Dashboard at `/admin` is the strategic headquarters for organization leaders. it provides deep visibility into team performance, project efficiency, and workforce health.

---

## 🏗️ Core Analytics Hub

The dashboard is divided into six specialized reporting modules:

### 1. **Recognition Leaderboard** 🏆
*   **Purpose**: Tracks "Recognition" points and extra performance bonuses.
*   **Filtering**: Supports **Monthly** and **All-Time** history.
*   **Views**: Toggle between a **Ranking List** and a **Performance Graph**.
*   **Goal**: Identify who is driving the most cultural and extra-mile impact.

### 2. **Sprint Leaderboard** 📊
*   **Purpose**: A full audit of total performance, including base participation.
*   **The Math**: `Base Points + Wins (Recognition/Extra) - Deductions (Bugs/Absences)`.
*   **Filtering**: Can be viewed for a **Specific Sprint** or as a cumulative **All-Time** lifetime score.

### 3. **Practice Growth (Goals)** 📚
*   **Goal Analysis Heatmap**: A color-coded breakdown of where the team is growing (e.g., 40% Learning, 30% Collaboration).
*   **Achievers List**: A searchable list of every user who has completed specific goals (Trailhead badges, Certifications, etc.), including their personal achievement logs.

### 4. **ROI Index (Project Efficiency)** ⚖️
*   **The Logic**: Compares **Total Team Effort (Allocation %)** against **Recognized Results (Points)**.
*   **Impact Mapping**: 
    *   **High Impact (ROI > 1.25)**: Projects generating massive results with minimal team effort. 🚀
    *   **High Effort (ROI < 0.75)**: Resource-heavy projects with lower-than-average recognition yields. 🛠️

### 5. **Quality Control** 🛡️
*   **Purpose**: Monitor systemic issues across the organization.
*   **The Audit**: Tracks "Deduction" items like Bugs, Absences, Documentation gaps, and Engagement issues.
*   **Goal**: Identify if quality issues are tied to specific sprints or are across the whole team.

### 6. **Team Health & Utilization** 👥
*   **Workload Audit**: A live overview of team resource allocation from the most recent sprint.
*   **Risk Signals**: 
    *   **Overloaded (> 100%)**: Flagging burnout risks. 🛑
    *   **Under-utilized (< 50%)**: Identifying available capacity/bench strength. 🛋️

---

## 🛠️ Security & Access

*   **Auth Requirement**: Access is restricted to users where `is_admin = true` on their profile.
*   **Verification**: Every page load and server action calls `requireAdmin()` to prevent unauthorized data access.
*   **Data Isolation**: All reports are automatically filtered by `org_id` to ensure multi-tenant security.

---

## 📁 Key Technical Files

| File | Role |
|------|------|
| `src/app/(app)/admin/page.tsx` | Main entry point — fetches all multi-sprint data in parallel. |
| `src/components/app/AdminDashboardClient.tsx` | The UI Engine — handles all filtering, graphing, and ROI math. |
| `src/app/(app)/sprints/actions.ts` → `getAdminAnalytics()` | Server action used to pull the full historical dataset for the org. |
| `@/lib/goals.ts` | Source of truth for goal definitions and categories. |
