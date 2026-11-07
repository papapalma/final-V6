# BMDC 1.1 - Trainee Management System
## Complete System Documentation

**Version:** 1.0  
**Last Updated:** September 2026  
**System:** BMDC 1.1 - Trainee Management & Attendance Tracking Platform

---

## 📋 Documentation Overview

This documentation provides comprehensive guidance for all user roles in the BMDC 1.1 system. Each section contains detailed instructions, workflows, and feature descriptions specific to each user's role and responsibilities.

### Documentation Structure

The documentation is organized by **user role and by page/feature**, making it easy to find exactly what you need:

1. **[Master Index](#master-index)** - Quick navigation to all documentation
2. **[Super Admin Docs](./01-SUPER-ADMIN-DOCUMENTATION.md)** - Platform-wide management
3. **[Local Admin Docs](./02-LOCAL-ADMIN-DOCUMENTATION.md)** - Tenant/organization management
4. **[Staff Training Coordinator Docs](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md)** - Attendance & program coordination
5. **[Staff Inventory Manager Docs](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md)** - Equipment & materials management
6. **[Trainee Docs](./05-TRAINEE-DOCUMENTATION.md)** - Personal learning portal
7. **[Security & Authentication](./06-SECURITY-AUTHENTICATION.md)** - System security overview
8. **[API Reference](./07-API-REFERENCE.md)** - Complete API endpoint documentation
9. **[System Architecture](./08-SYSTEM-ARCHITECTURE.md)** - Technical architecture & data flows
10. **[System Activity Diagrams](./09-SYSTEM-ACTIVITY-DIAGRAM.md)** - Whole system lifecycle & operational workflows
11. **[System Architecture Diagram](./10-SYSTEM-ARCHITECTURE-DIAGRAM.md)** - Multi-tier system architecture & infrastructure integration
12. **[Data Flow Diagram](./11-SYSTEM-DATA-FLOW-DIAGRAM.md)** - System data flow specifications in Yourdon notation
13. **[Comprehensive Activity Diagram](./12-SYSTEM-ACTIVITY-DIAGRAM.md)** - Whole-system operational lifecycle with full route coverage (UML 2.5)

---

## 🎯 Quick Start by Role

### I'm a Super Admin
Start here: [Super Admin Documentation](./01-SUPER-ADMIN-DOCUMENTATION.md)
- Manage all tenants and organizations
- View platform-wide analytics
- Create and manage local admins
- Monitor system activity

### I'm a Local Admin / Organization Manager
Start here: [Local Admin Documentation](./02-LOCAL-ADMIN-DOCUMENTATION.md)
- Manage trainees and registrations
- Create and manage training programs
- Configure organization settings
- View organization reports

### I'm a Training Coordinator
Start here: [Staff Training Coordinator Docs](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md)
- Track trainee attendance
- Manage training programs
- Generate reports and certificates
- Configure attendance settings

### I'm an Inventory Manager
Start here: [Staff Inventory Manager Docs](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md)
- Manage training equipment and materials
- Track item borrowing and lending
- Generate borrowing slips
- Monitor inventory stock

### I'm a Trainee
Start here: [Trainee Documentation](./05-TRAINEE-DOCUMENTATION.md)
- View enrolled programs
- Mark daily attendance
- Download certificates
- Access training materials

---

## 🔐 Master Index

### Documentation Files

| Document | Purpose | Audience |
|----------|---------|----------|
| [01-SUPER-ADMIN-DOCUMENTATION.md](./01-SUPER-ADMIN-DOCUMENTATION.md) | Platform administration, tenant management | Super Admin |
| [02-LOCAL-ADMIN-DOCUMENTATION.md](./02-LOCAL-ADMIN-DOCUMENTATION.md) | Organization/LGU management, staff oversight | Local Admin |
| [03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md) | Attendance tracking, program coordination | Training Coordinator |
| [04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md) | Equipment inventory, borrowing management | Inventory Manager |
| [05-TRAINEE-DOCUMENTATION.md](./05-TRAINEE-DOCUMENTATION.md) | Personal learning portal, attendance marking | Trainees |
| [06-SECURITY-AUTHENTICATION.md](./06-SECURITY-AUTHENTICATION.md) | Security model, auth flows, best practices | All |
| [07-API-REFERENCE.md](./07-API-REFERENCE.md) | Complete API endpoint reference | Developers |
| [08-SYSTEM-ARCHITECTURE.md](./08-SYSTEM-ARCHITECTURE.md) | System design, database schema, flows | Developers, Architects |
| [09-SYSTEM-ACTIVITY-DIAGRAM.md](./09-SYSTEM-ACTIVITY-DIAGRAM.md) | Whole system lifecycle & operational workflows | All Roles, Developers, Architects |
| [10-SYSTEM-ARCHITECTURE-DIAGRAM.md](./10-SYSTEM-ARCHITECTURE-DIAGRAM.md) | Multi-tier architecture diagram & infrastructure integration | All Roles, Developers, Architects |
| [11-SYSTEM-DATA-FLOW-DIAGRAM.md](./11-SYSTEM-DATA-FLOW-DIAGRAM.md) | System data flow specifications in Yourdon notation | All Roles, Developers, Architects |
| [12-SYSTEM-ACTIVITY-DIAGRAM.md](./12-SYSTEM-ACTIVITY-DIAGRAM.md) | Whole-system operational lifecycle with full route coverage (UML 2.5) | All Roles, Developers, Architects |

---

## 📑 System Features by Category

### Authentication & User Management
- Multi-tenant login system
- Tenant selection for multi-tenant users
- Password reset workflow
- Token-based session management
- Role-based access control

**See:** [Security & Authentication](./06-SECURITY-AUTHENTICATION.md)

### Trainee Management
- Self-service registration
- Admin registration approval
- Trainee profile management
- Trainee search and filtering
- Bulk operations

**See:** [Local Admin - Trainees Page](./02-LOCAL-ADMIN-DOCUMENTATION.md#trainees-page)

### Program Management
- Create training programs
- Set program details and duration
- Manage program enrollment
- Program status tracking
- Public enrollment links

**See:** [Local Admin - Programs Page](./02-LOCAL-ADMIN-DOCUMENTATION.md#programs-page)

### Attendance Tracking
- Mark daily attendance with photo
- Morning and afternoon sessions
- Attendance calendar view
- Attendance statistics
- Non-attendance exceptions

**See:** [Staff Training Coordinator - Attendance Page](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md#attendance-page)

### Certificate Management
- Automatic certificate generation
- Certificate verification
- QR code tracking
- Public verification links

**See:** [Trainee - Certificates](./05-TRAINEE-DOCUMENTATION.md#certificates)

### Inventory Management
- Create inventory items
- Track item status
- Manage borrowing/lending
- Borrowing slip generation
- Overdue tracking

**See:** [Staff Inventory Manager - Items Page](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md#items-page)

### Reporting & Analytics
- Attendance reports
- Enrollment statistics
- Performance analytics
- Audit logs
- Cross-tenant analytics (Super Admin)

**See:** 
- [Local Admin - Reports](./02-LOCAL-ADMIN-DOCUMENTATION.md#reports-page)
- [Super Admin - Reports](./01-SUPER-ADMIN-DOCUMENTATION.md#reports-page)

---

## 🔑 Key Concepts

### Multi-Tenancy
The system supports multiple independent organizations (LGUs, training centers). Each tenant:
- Has isolated data and users
- Manages their own programs and trainees
- Has independent branding and settings
- Cannot see other tenants' data

### User Roles (5 Levels)
1. **Super Admin** - Platform administrator (all tenants)
2. **Local Admin** - Organization administrator (single tenant)
3. **Staff Training Coordinator** - Attendance and program coordination
4. **Staff Inventory Manager** - Equipment and materials management
5. **Trainee** - Training participant

### Workflow: Registration → Approval → Training → Completion
1. Trainee self-registers online
2. Local admin approves/rejects registration
3. Approved trainees gain login access
4. Trainees enroll in programs
5. Daily attendance tracking begins
6. Certificate generated upon completion

---

## 🛡️ Security Overview

The system implements enterprise-grade security:

- **Encrypted Authentication**: JWT tokens with AES-256 encryption
- **Tenant Isolation**: Database-level row-level security (RLS)
- **Role-Based Access**: Granular permission control per feature
- **Password Security**: bcrypt hashing with 12 salt rounds
- **Session Management**: Short-lived tokens with auto-refresh
- **Audit Logging**: All actions logged with timestamps and user IDs
- **Data Validation**: Zod schema validation on all inputs

**Full Details:** [Security & Authentication](./06-SECURITY-AUTHENTICATION.md)

---

## 🚀 Common Tasks by Role

### For Super Admins
- [Create a new tenant](./01-SUPER-ADMIN-DOCUMENTATION.md#creating-a-new-tenant)
- [Create a local admin account](./01-SUPER-ADMIN-DOCUMENTATION.md#creating-local-admin-accounts)
- [View platform analytics](./01-SUPER-ADMIN-DOCUMENTATION.md#reports-page)
- [Manage system settings](./01-SUPER-ADMIN-DOCUMENTATION.md#system-settings)

### For Local Admins
- [Approve trainee registrations](./02-LOCAL-ADMIN-DOCUMENTATION.md#registrations-page)
- [Create a training program](./02-LOCAL-ADMIN-DOCUMENTATION.md#creating-a-program)
- [Create staff accounts](./02-LOCAL-ADMIN-DOCUMENTATION.md#accounts-page)
- [Configure organization settings](./02-LOCAL-ADMIN-DOCUMENTATION.md#settings-page)

### For Training Coordinators
- [Mark trainee attendance](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md#marking-attendance)
- [Configure non-attendance dates](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md#non-attendance-dates-page)
- [Generate reports](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md#reports)
- [Create certificates](./03-STAFF-TRAINING-COORDINATOR-DOCUMENTATION.md#certificate-generation)

### For Inventory Managers
- [Create inventory items](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md#creating-items)
- [Track borrowing](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md#tracking-borrowing)
- [Generate borrowing slips](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md#borrowing-slip-generation)
- [Manage overdue items](./04-STAFF-INVENTORY-MANAGER-DOCUMENTATION.md#overdue-tracking)

### For Trainees
- [Register for training](./05-TRAINEE-DOCUMENTATION.md#registration-flow)
- [Mark attendance](./05-TRAINEE-DOCUMENTATION.md#attendance-marking)
- [View certificates](./05-TRAINEE-DOCUMENTATION.md#certificates)
- [Access training materials](./05-TRAINEE-DOCUMENTATION.md#enrolled-programs)

---

## 📞 Support & Troubleshooting

### Common Issues

**Can't log in?**
- Check your email and password are correct
- Verify your registration has been approved by an admin
- Clear your browser cache and try again
- See: [Security - Login Troubleshooting](./06-SECURITY-AUTHENTICATION.md#login-troubleshooting)

**Missing data or permissions?**
- Verify your user role matches what you're trying to do
- Check that you've selected the correct tenant (if multi-tenant)
- See: [Role Permissions Matrix](./06-SECURITY-AUTHENTICATION.md#role-permissions-matrix)

**Can't find a specific feature?**
- Use the role-specific documentation files
- Check the API Reference for available endpoints
- See: [System Architecture - Feature Checklist](./08-SYSTEM-ARCHITECTURE.md#feature-checklist)

---

## 📊 System Statistics

- **User Roles**: 5 distinct roles with hierarchical permissions
- **API Endpoints**: 50+ RESTful endpoints
- **Database Tables**: 30+ normalized tables (3NF schema)
- **Pages/Features**: 40+ user-facing pages and components
- **Multi-Tenant**: Full tenant isolation with RLS policies

---

## 🔄 Release Notes

### Version 1.0 (Current)
- Complete multi-tenant architecture
- 5-role permission system
- Trainee registration and approval workflow
- Attendance tracking with photo verification
- Inventory management and borrowing system
- Certificate generation and verification
- Role-based reporting and analytics
- Audit logging and activity tracking

---

## 📝 Documentation Conventions

- **Button names** are shown in **bold**: "Click **Save**"
- **Page titles** are shown in **bold**: "On the **Dashboard** page"
- **Field labels** are shown in `code`: "Enter your `Email`"
- **API endpoints** are shown in `code`: "`POST /api/trainees`"
- **Steps** are numbered: "1. First step 2. Second step"
- **Important notes** are preceded by ⚠️ or 💡
- **Security-related items** are marked with 🔐

---

## 📞 Getting Help

If you need help with a specific feature:

1. **Find your role** in the Quick Start section above
2. **Open the role-specific documentation**
3. **Find the page or feature** you need help with
4. **Follow the step-by-step instructions**
5. **Check the Common Issues section** if you encounter problems

For technical questions or bugs, contact the system administrator.

---

## 🗂️ Table of Contents

- [Master Index](#-master-index)
- [Quick Start by Role](#-quick-start-by-role)
- [System Features by Category](#-system-features-by-category)
- [Key Concepts](#-key-concepts)
- [Security Overview](#️-security-overview)
- [Common Tasks by Role](#-common-tasks-by-role)
- [Support & Troubleshooting](#-support--troubleshooting)
- [Documentation Files](#documentation-files)

---

**Last Updated:** September 2026  
**Documentation Version:** 1.0  
**System Version:** BMDC 1.1

For questions or updates to this documentation, please contact the system administrator.
