# Keptly

Keptly is a mobile household management app built to help families, couples, roommates, and shared households stay organized. It combines task management, calendar visibility, household records, and member collaboration into one streamlined experience.

Built with **React Native + Expo** and powered by **Supabase**, Keptly is designed to reduce the mental load of managing a home.

---

## Features

- Shared household task management
- Household creation and member invites
- Recurring task support
- Calendar-based task visibility
- Overdue and upcoming task tracking
- Household provider and service record management
- Active household switching
- Supabase authentication and persistent sessions

---

## Screens / Core Modules

### Authentication
- Sign up and log in with Supabase Auth
- Persistent session handling

### Households
- Create a household
- Invite members
- Switch between active households
- Track household membership

### Tasks
- Create, edit, delete, and complete tasks
- Organize tasks by category
- Set due dates
- Support recurring schedules
- Filter tasks by:
  - Today
  - Tomorrow
  - Next 7 Days
  - Overdue

### Calendar
- View tasks in a calendar layout
- Track deadlines and recurring responsibilities
- Foundation for future external calendar syncing

### Records
- Store provider information
- Track service history
- Keep household-related records organized

---

## Tech Stack

- **Frontend:** React Native, Expo
- **Routing:** Expo Router
- **Backend:** Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth
- **State Management:** React hooks and local utilities

---

## Project Structure

```bash
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    tasks.tsx
    calendar.tsx
    records.tsx
    profile.tsx

components/
  screen.tsx

lib/
  supabase.ts
  household.ts
  task-recurrence.ts