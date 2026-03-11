# Prospects / Lead Page

## Layout Architecture Overview

This page uses a **complex, multi‑column dashboard layout**:

- **Background Color:** Light grey/blue (`bg-slate-50`).
- **Layout Structure:** Full-height flex container divided into **three vertical columns**:
  1. **Primary Sidebar (Far Left):**  
     - Very narrow (approx. 60–80px).  
     - Icon‑only navigation.
  2. **Secondary Sidebar (Lists Panel):**  
     - Fixed width (~250–280px).  
     - Acts as the CRM folder/list navigation.
  3. **Main Content Area (Right):**  
     - `flex-1` (expands to remaining width).  
     - Contains the header + main list workspace.

---

## Component 1: Primary Sidebar (Collapsed Navigation)

A compact icon‑only version of the Home page sidebar.

### **Styles**
- Background: **White**
- Subtle right border
- Icons centered vertically

### **Items (Top → Bottom)**

- **Logo:** Alien head only (no text)
- **Home** icon
- **Prospects** icon — *Active* (blue rounded-square background + white icon)
- **Campaigns** icon
- **Inbox** icon
- **Team** icon

### **Mid Section**
- Upsell widget: reduced to a **single gradient square** containing the white crown icon

### **Bottom Section**
- Pricing icon  
- Settings icon  
- Demo icon  

---

## Component 2: Secondary Sidebar (“Lists” Panel)

Right next to the primary sidebar. Manages folders/lists of prospects.

### **Styles**
- Background: Very light grey / transparent (matching page background)
- Vertical stack of controls and list items

### **Header Section**
- **Title:** **Lists** (large & bold)
- **Button:** **+ Add list** (solid brand blue, rounded)

### **Search Tools**
- **Search Bar:**  
  - Full width  
  - Left-aligned magnifying glass  
  - Placeholder: *Search*

- **Sort Dropdown:**  
  - Label: *Sort by:*  
  - Dropdown: **Recently created** + right chevron

### **List Items**
1. **All prospects**  
   - Grid icon  
2. **My First List** — *Active*  
   - White rounded card with subtle shadow  
   - Gold medal icon  
3. **LEADMATE (sample list)**  
   - Magic wand icon  

### **Collapse Button**
- Small circular button with a **left chevron (<)**  
- Located at the right edge of the sidebar  
- Hides the Lists panel when clicked

---

## Component 3: Top Navbar (Header)

Spans the **Main Content Area only**, identical to the Home page header.

### **Right-Aligned Items**
- **Subscribe** (outline button)
- **Start a campaign** (solid blue button)
- **Credits pill:** yellow icon + *500 credits*
- Notification bell icon
- **User profile:** "Raja Singh" + dropdown chevron

---

## Component 4: Main Content Area (“My First List”)

Primary workspace for managing leads.

### **Container**
- Large **white card**
- Rounded corners
- Soft shadow
- Occupies most of the right section

---

### **Header Row**
- **Title:** **My First List**
- **Edit Action:**  
  - Dark square button  
  - White pencil/edit icon
- **Count Badge:**  
  - Small pill (light blue background)  
  - User icon + “0” in blue text

---

### **Search & Action Row**
- **Main Search:**  
  - Wide input field  
  - Left search icon  
  - Placeholder: *Search*
- **Action Button:**  
  - **Import** + down-chevron  
  - Solid blue button

---

### **Filter Pills Row**
A horizontal **scrollable** row of rounded filter chips:

- Status  
- State  
- Tags  
- LinkedIn Visit/Follow  
- Gender  
- LinkedIn messages  
- Email  
- CRM  
- **+ More filters** (blue border + blue text)

---

### **Empty State Body**
Centered both vertically & horizontally.

- **Icon:** telescope (dark grey)
- **Title:** **No signs of life detected**
- **Subtitle:** *Your mission: Import prospects*
- **CTA Button:** **Import** + down chevron (solid blue button)

---

## Component 5: Floating Elements (Fixed)

Same floating UI as the Home page:

### **Bottom Right**
- Circular chat widget  
- Solid blue  
- White smiling face icon

### **Mid-Right Edge**
- Small dark square  
- Sun/starburst icon  
- Likely theme toggle or quick-access settings