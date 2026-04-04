# Sprint Management (Admin Guide)

The **Sprint Tracker** is the primary data source for the organization's performance analytics. Proper management here ensures accurate ROI and Leaderboard data.

---

## 🏗️ 1. Creating a New Sprint

When you create a new sprint:
1.  **Name**: Give it a clear name (e.g., "Sprint 25 - Frontend Phase").
2.  **Date Range**: Ensure start and end dates are correct, as these determine the **Monthly Filtering** in the Analytics dashboard.
3.  **Base Points**: Standardize this across your organization (e.g., 20 or 50 points) so that "All-Time" points stay comparable.
4.  **Auto-Enrollment**: Kudos automatically adds all current organization members to a new sprint by default.

---

## 🎯 2. The Grid Tracker (Data Entry)

The grid allows you to manage four critical data types:

### **Allocation (Effort %)**
*   Each person should be assigned to one or more projects.
*   **The 100% Rule**: Total allocation for a user must equal 100%.
*   **Visual Guard**: The "Total %" column will turn **Red** if someone is over-allocated and **Green** when they reach exactly 100%.

### **Performance Wins (+)**
Enter points in columns like "Extra Mile" or "Recognition" to reward exceptional work. These drive the **Recognition Leaderboard**.

### **Audit Deductions (-)**
Enter negative values (e.g., -5) for "Bugs," "Absences," or "Comms issues." These populate the **Quality Control Dashboard**.

### **Bulk Saving**
*   **Save All Changes**: Use the global save button at the top to commit all row edits in a single transaction. ⚡️

---

## 🔄 3. Sprint Lifecycle (Active vs. Completed)

*   **Active**: Sprints are created as `Active` by default. They pulse with a green indicator and allow live data entry.
*   **Completed**: Once a sprint is over and all points are audited, mark it as `Completed`.
*   **Why Complete?**: 
    1.  It signals to the team that the results are final.
    2.  It "locks" the analytics into the historical record for **ROI calculation**.
    3.  A completed sprint can be re-opened by an admin if a correction is needed. 🔓

---

## 🧭 4. Using the Stats Tab

Every sprint has an internal **Stats** tab. Admins should check this periodically to see live rankings *before* the sprint is even closed. It helps identify your top performers in real-time.

---

## 📁 Key Technical Files

| Role | File |
|------|------|
| **Sprint Actions** | `src/app/(app)/sprints/actions.ts` |
| **Grid Logic** | `src/components/app/SprintDetailClient.tsx` |
| **Management UI** | `src/components/app/SprintsClient.tsx` |
