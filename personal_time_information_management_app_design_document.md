# Personal Time & Information Management App --- Design Document

## 1. Project Overview

This project is a personal utility application designed to centralize
time-sensitive information, reminders, game events, personal/work tasks,
and account information in one place.

The core idea is:

> **A personal system that remembers time-sensitive things for me.**

The application should be primarily mobile-focused because the mobile
device is the most likely place for notifications to be seen. A PC/web
interface will also be provided for easier manual data entry,
administration, and detailed management.

The system should support both manually entered information and
automatically sourced information, particularly for games such as
Genshin Impact.

------------------------------------------------------------------------

## 2. Main Goals

The application should:

-   Provide a clean, easy-to-use dashboard.
-   Provide calendar and event views.
-   Provide reminders and mobile notifications.
-   Support recurring reminders and events.
-   Allow manual entry of personal, school, and work information.
-   Automatically retrieve game-related information where reliable
    sources are available.
-   Track game events, banners, resets, and other time-sensitive
    content.
-   Provide quick access to important information.
-   Eventually provide a secure personal account/credential vault.
-   Keep automatically sourced and manually entered information within
    the same unified event/reminder system.

------------------------------------------------------------------------

## 3. Target Devices

### Primary Device: Mobile

The mobile application is the primary interface.

It should prioritize:

-   Notifications
-   Today's events
-   Upcoming reminders
-   Countdown timers
-   Quick-add functionality
-   Quick actions such as snooze, complete, or dismiss
-   Game status information

### Secondary Device: PC/Web

The PC interface is intended primarily for:

-   Manual data entry
-   Detailed event editing
-   Managing games
-   Managing recurring events
-   Reviewing calendar information
-   Managing account information
-   Administrative tasks

The PC and mobile applications should access the same backend and
database.

------------------------------------------------------------------------

## 4. High-Level Architecture

The eventual architecture is expected to look like:

    ┌──────────────────────────────┐
    │        Cloud Backend        │
    │                             │
    │  PHP API                   │
    │  PostgreSQL                │
    │  Scheduled Jobs            │
    │  Game Data Importers       │
    │  Reminder Processing       │
    └──────────────┬──────────────┘
                   │
                  API
                   │
          ┌────────┴─────────┐
          │                  │
    ┌─────▼─────┐      ┌─────▼─────┐
    │  Mobile   │      │  Web/PC   │
    │   App     │      │   App     │
    │           │      │           │
    │ React     │      │ React     │
    │ Native    │      │           │
    └───────────┘      └───────────┘

The backend is responsible for data storage, business logic, automated
data retrieval, scheduled processing, and notification-related services.

The frontend applications should communicate with the backend through
REST APIs rather than accessing the database directly.

------------------------------------------------------------------------

## 5. Proposed Technology Stack

  -----------------------------------------------------------------------
  Component                           Technology
  ----------------------------------- -----------------------------------
  Mobile frontend                     React Native

  PC/Web frontend                     React

  Backend                             PHP

  API                                 REST API

  Database                            PostgreSQL

  Database management                 DBeaver

  Development environment             Visual Studio Code

  JavaScript runtime/package manager  Node.js + npm

  Version control                     Git

  Repository                          GitHub

  Calendar component                  FullCalendar or equivalent

  Automated scheduling                Cron / Windows Task Scheduler
                                      initially; cloud scheduler
                                      eventually

  Notifications                       Mobile push notifications / Web
                                      Push

  Password encryption                 PHP OpenSSL/libsodium or equivalent
                                      secure cryptographic library
  -----------------------------------------------------------------------

The project can initially be developed entirely on the user's PC using
localhost services. Deployment to a cloud/VPS environment can occur
after the core application is functional.

------------------------------------------------------------------------

# 6. Core Functional Areas

## 6.1 Dashboard

The dashboard is the primary landing page.

It should show information that is immediately relevant to the user,
such as:

-   Today's reminders
-   Events ending soon
-   Upcoming events
-   Upcoming deadlines
-   Game resets
-   Important countdowns
-   Recently completed items

Example:

    GOOD AFTERNOON

    TODAY
    ─────────────────────────
    Genshin event       3h 12m
    Assignment          Tomorrow
    Daily reset         13h 17m

    UPCOMING
    ─────────────────────────
    Weekly reset        Tomorrow
    Genshin event       15 Aug

The dashboard should minimize the amount of navigation required to see
important information.

------------------------------------------------------------------------

## 6.2 Calendar

A calendar should provide a visual representation of:

-   Personal events
-   Work events
-   School deadlines
-   Game events
-   Recurring events
-   Reminders

Possible views:

-   Month
-   Week
-   Day
-   Agenda/list

A third-party calendar component such as FullCalendar can be considered
rather than implementing the entire calendar system from scratch.

------------------------------------------------------------------------

## 6.3 Reminders

Reminders should support:

-   One-time reminders
-   Recurring reminders
-   Multiple reminder times
-   Snoozing
-   Completion
-   Dismissal
-   Reminder history

Example:

    Assignment deadline:
        7 days before
        3 days before
        1 day before
        2 hours before

Another example:

    Genshin event:
        6 hours before
        1 hour before

Reminder timing should be configurable rather than fixed.

------------------------------------------------------------------------

## 6.4 Recurring Events

Recurring events should be supported natively.

Examples:

-   Daily
-   Weekly
-   Monthly
-   Custom recurring schedules

Game examples:

    Genshin daily reset
        Every day at 04:00

    Genshin weekly reset
        Every Monday at 04:00

Personal examples:

    Weekly work task
        Every Friday

    Monthly task
        Once per month

The system should calculate future occurrences rather than requiring
every occurrence to be individually stored.

------------------------------------------------------------------------

# 7. Game Tracking

Games are a major feature of the application, but they should use the
same underlying event and reminder system as personal and work
information.

A game may contain:

-   Events
-   Event start/end dates
-   Banners
-   Version dates
-   Daily resets
-   Weekly resets
-   Other time-sensitive content

Example:

    Genshin Impact

    Events
    ─────────────────────
    Event A          3h remaining
    Event B          2 days

    Banners
    ─────────────────────
    Character A      4 days

    Resets
    ─────────────────────
    Daily            13h
    Weekly           3 days

The system should allow multiple games to be tracked.

------------------------------------------------------------------------

# 8. Automated Game Data

Game information should support multiple data sources.

## 8.1 Manual

The user can manually create events when no reliable automated source
exists.

Example:

    Game: Game A
    Event: Special Event
    Start: 20 Aug
    End: 30 Aug

## 8.2 API/Data Source

Where a game provides a suitable API or reliable structured data source,
the application can periodically retrieve information automatically.

## 8.3 Website/Official Source Parsing

Where no suitable API exists, the application may retrieve information
from official announcements or other reliable publicly available
sources.

This approach is less robust because websites can change their
structure.

------------------------------------------------------------------------

# 9. Genshin Impact as the First Automated Integration

Genshin Impact is intended to be the initial test case for automated
game data.

Potential sources include:

-   Official HoYoLAB event information
-   Official HoYoLAB news/announcements
-   Community-maintained datasets
-   Other suitable public data sources

The application should not blindly trust imported information.

A preferred workflow is:

    Source
       ↓
    Importer
       ↓
    Detect new/changed event
       ↓
    Store proposed event
       ↓
    Optional user confirmation
       ↓
    Active event
       ↓
    Reminder system

Each imported event should retain source information.

Example:

    Event:
        Summer Festival

    Source:
        HoYoLAB

    Source URL:
        <stored source URL>

    Last updated:
        <timestamp>

    Automatically imported:
        Yes

    Confirmed:
        Yes

This makes it easier to identify incorrect information and debug broken
integrations.

------------------------------------------------------------------------

# 10. Unified Event Model

The application should not treat game events, work reminders, school
deadlines, and personal reminders as completely separate systems.

They should ultimately become time-based records handled by the same
event/reminder engine.

For example:

    Event
    ├── Personal
    ├── Work
    ├── School
    ├── Game
    └── Other

An event may also have:

-   Name
-   Description
-   Start time
-   End time
-   Recurrence
-   Category
-   Tags
-   Source
-   Source URL
-   Automatic/manual origin
-   Completion status
-   Reminder configuration

This allows an automatically imported Genshin event and a manually
entered work deadline to be displayed together in the calendar.

------------------------------------------------------------------------

# 11. Countdown System

Time-sensitive events should be able to display countdowns.

Example:

    EVENT ENDING

         03:14:27

    Summer Event
    Genshin Impact

Countdowns can be displayed on:

-   Dashboard
-   Game pages
-   Event pages
-   Notifications
-   Potentially mobile widgets in a later version

Important countdowns may be pinned by the user.

------------------------------------------------------------------------

# 12. Quick Add

The mobile application should provide a fast way to create reminders
without navigating through multiple screens.

Example:

    + Quick Add

    "Submit assignment Friday 6pm"

The application could interpret the basic information and present a
confirmation screen:

    Submit assignment

    Friday
    18:00

    Reminder:
    1 day before

    [Save]

Natural-language parsing is an optional future feature. The initial
implementation can use a normal form.

------------------------------------------------------------------------

# 13. Notifications

Notifications are one of the primary reasons for having a mobile
application.

Examples:

    Genshin Event
    This event ends in 1 hour.

    Assignment
    This assignment is due tomorrow.

Notifications should support actions where practical.

Possible actions:

-   Open
-   Complete
-   Dismiss
-   Snooze
-   Open related game/event

The system should eventually be able to send notifications even when the
user's PC is turned off.

This requires the backend/scheduler and notification infrastructure to
run on an always-available server.

------------------------------------------------------------------------

# 14. Snooze

Notifications should support quick snoozing.

Possible options:

-   15 minutes
-   1 hour
-   3 hours
-   Tonight
-   Tomorrow
-   Custom time

Snoozing should create/update the reminder rather than simply dismissing
it.

------------------------------------------------------------------------

# 15. Search and Filtering

As the amount of information increases, search will become important.

The application should eventually support searching across:

-   Events
-   Reminders
-   Games
-   Notes
-   Accounts

Useful filters may include:

-   Game
-   Category
-   Tag
-   Date
-   Active/completed
-   Manual/automatic
-   Upcoming/expired

------------------------------------------------------------------------

# 16. Tags and Categories

The user should be able to assign tags such as:

    #work
    #school
    #genshin
    #urgent
    #personal
    #financial

Tags can be combined with categories to make information easier to
filter.

------------------------------------------------------------------------

# 17. Notes / Personal Information

A lightweight personal notes area could be included for information that
does not naturally fit into an event.

Examples:

-   Important project information
-   Where something is stored
-   Configuration notes
-   Personal reference information
-   Game-related notes

This should remain lightweight rather than attempting to become a full
document-management application.

------------------------------------------------------------------------

# 18. Account / Credential Vault

The application may eventually include a secure area for storing login
information.

Potential fields:

-   Service name
-   Username/email
-   Password
-   URL
-   Category
-   Notes
-   Tags

Example:

    Steam

    Username
    example@email.com       [Copy]

    Password
    ••••••••••••            [Copy]

This subsystem requires significantly stronger security than ordinary
reminder data.

Passwords must never be stored as plaintext.

Encrypted credentials should be used, and encryption keys should not
simply be stored alongside the encrypted data in the database.

The credential vault should therefore be developed after the core
reminder/calendar system is working.

------------------------------------------------------------------------

# 19. Database Concept

An initial database could contain tables such as:

    users
    games
    events
    reminders
    recurring_events
    notification_settings
    data_sources
    accounts

A simplified event structure could include:

    events
    ─────────────────────
    id
    game_id
    name
    description
    start_time
    end_time
    category
    source
    source_url
    is_automatic
    is_confirmed
    created_at
    updated_at

The final schema should be designed in detail before implementation.

------------------------------------------------------------------------

# 20. Backend API

The React and React Native applications should communicate with PHP
through REST API endpoints.

Example endpoints:

    GET    /api/events
    POST   /api/events
    PUT    /api/events/{id}
    DELETE /api/events/{id}

    GET    /api/reminders
    POST   /api/reminders
    PUT    /api/reminders/{id}

    GET    /api/games
    POST   /api/games

The exact API structure will be designed later.

The frontend should not directly access PostgreSQL.

------------------------------------------------------------------------

# 21. Automation and Scheduling

Automated game data retrieval requires scheduled backend processes.

During development, scheduled scripts can be run using:

-   Windows Task Scheduler
-   Cron

For deployment, scheduled jobs can run on a cloud/VPS environment.

Example:

    Every hour
        ↓
    Genshin importer
        ↓
    Check source
        ↓
    Detect changes
        ↓
    Update database

Other scheduled processes may handle:

-   Reminder generation
-   Notification dispatch
-   Data refresh
-   Cleanup of expired temporary data

------------------------------------------------------------------------

# 22. Hosting Strategy

## Development

Initially everything can run locally:

    PC
    ├── React
    ├── PHP
    └── PostgreSQL

This allows development without paying for hosting.

## Production

Eventually the backend and database should be hosted somewhere that
remains available while the user's PC is turned off.

Example:

    Cloud/VPS
    ├── PHP API
    ├── PostgreSQL
    ├── Scheduled jobs
    └── Notification services

The mobile and PC applications connect to this backend over the
internet.

This allows:

-   Notifications while the PC is off
-   Automatic game data updates
-   Access from multiple devices
-   Persistent data availability

The exact hosting provider can be selected later.

------------------------------------------------------------------------

# 23. Development Roadmap

The project should be developed incrementally.

## Phase 1 --- Planning

-   Define requirements
-   Design database
-   Define event/reminder model
-   Define application architecture
-   Define API structure

## Phase 2 --- Development Environment

-   Install/configure Node.js
-   Configure React
-   Configure React Native
-   Configure PHP
-   Configure PostgreSQL
-   Configure Git/GitHub
-   Establish local development environment

## Phase 3 --- Backend

-   Create PostgreSQL database
-   Create initial schema
-   Build PHP API
-   Implement CRUD operations
-   Implement validation and error handling

## Phase 4 --- Web Frontend

-   Build dashboard
-   Build calendar
-   Build event management
-   Build reminder management
-   Build recurring events
-   Build search/filtering

## Phase 5 --- Mobile Application

-   Build mobile dashboard
-   Build calendar/event views
-   Build quick-add
-   Build countdowns
-   Connect to backend
-   Implement mobile notifications

## Phase 6 --- Automation

-   Build generic data-source system
-   Build Genshin data importer
-   Store source information
-   Detect new/changed events
-   Add confirmation workflow if appropriate

## Phase 7 --- Advanced Features

-   Snooze
-   Notification actions
-   Tags
-   Notes
-   Game dashboards
-   Additional game integrations

## Phase 8 --- Secure Credential Vault

-   Authentication/security architecture
-   Encrypted credential storage
-   Secure credential retrieval
-   Copy-to-clipboard functionality
-   Additional security controls

## Phase 9 --- Deployment

-   Select hosting
-   Deploy backend
-   Deploy database
-   Configure scheduled jobs
-   Configure notification infrastructure
-   Connect mobile application to production backend
-   Configure backups and recovery

------------------------------------------------------------------------

# 24. Design Principles

The following principles should guide development:

### Mobile-first

The mobile application is the primary user experience.

### Unified

Game events, personal reminders, school deadlines, and work tasks should
use the same underlying event/reminder system.

### Automation where useful

Information should be automatically retrieved when a reliable source
exists, but manual entry should always remain available.

### Human confirmation where appropriate

Automatically imported data should not necessarily be trusted blindly.

### Source-aware

Automatically obtained information should record its source and last
update time.

### Local development first

The application should initially run locally before introducing cloud
hosting costs and deployment complexity.

### Security by separation

Sensitive credentials should be separated logically and technically from
ordinary reminder data.

### Extensible

The system should support adding additional games and data sources
without redesigning the core application.

------------------------------------------------------------------------

# 25. Initial Scope

The first functional version should focus on:

1.  Dashboard
2.  Calendar
3.  Manual events
4.  Manual reminders
5.  Recurring events
6.  Countdown displays
7.  Mobile notifications
8.  Basic game tracking
9.  Genshin data integration

The credential vault, natural-language quick-add, advanced automation,
additional games, and other advanced features should be considered later
additions.

------------------------------------------------------------------------

# 26. Overall Vision

The completed application should function as a personal time-sensitive
information hub.

Rather than being simply a calendar, password manager, or game tracker,
it should combine these functions around a central purpose:

> **Keep track of things that the user would otherwise have to
> remember.**

The application should automatically handle information when reliable
sources are available, while allowing the user to manually add anything
that cannot be automatically sourced.

The ideal final experience is:

    Something happens
          ↓
    App knows about it
          ↓
    App tracks the time
          ↓
    App reminds the user
          ↓
    User takes action

This allows the application to gradually become a personalized system
for managing games, work, school, personal tasks, and other
time-sensitive information.
