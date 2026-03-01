# Settings (My Account View)

## Layout Architecture Overview

This page provides a structured settings interface with a dual‑sidebar layout.

- **Background Color:** Light grey/blue (`bg-slate-50`)
- **Layout Structure:**
  - **Primary Sidebar (Left):** Collapsed, icon-only navigation
  - **Secondary Sidebar (Settings Navigation):** Fixed width (~250px) containing all configuration categories
  - **Main Content Area (Right):** `flex-1`, contains the top navbar, page heading, and stacked configuration cards

---

## Component 1: Primary Sidebar (Collapsed Navigation)

### **Styles**
- Background: **White (`bg-white`)**
- Subtle right border
- Icons arranged vertically

### **Items**
- Alien head logo (top)
- **Home** — inactive  
- **Prospects** — inactive  
- **Campaigns** — inactive  
- **Inbox** — inactive  
- **Team** — inactive  
- **Settings** — **active**  
  - Blue rounded-square background  
  - White gear icon

---

## Component 2: Secondary Sidebar (“Settings” Navigation)

### **Header**
- **Settings** (large, bold)

### **Navigation Items (Vertical Stack)**

1. **My account** — *Active*  
   - White rounded card with subtle shadow  
   - Icon: Alien head in light blue circle  
   - Bold dark text  

2. **LinkedIn Account**  
   - Icon: LinkedIn “in” logo in blue circle  

3. **Account activity**  
   - Icon: Clock in teal circle  

4. **Email accounts**  
   - Icon: Paper plane in purple circle  

5. **Integrations**  
   - Icon: Nodes in dark blue circle  
   - **BETA** badge (small, blue)

6. **Invoices**  
   - Icon: Document in light blue circle  

7. **Import history**  
   - Icon: Checklist in pink circle  

---

## Component 3: Top Navbar (Header)

A floating pill-shaped white header positioned toward the top-right.

### **Elements**
- **Subscribe** — outline button  
- **Start a campaign** — solid blue button  
- **Credits:** “500 credits” pill  
- Notification bell icon  
- **User Profile:** “Raja Singh” + dropdown chevron  

---

## Component 4: Main Content Area (“My account”)

### **Page Header**
- `<h1>` **My account** — large, bold, dark text

---

## Configuration Cards (Vertical Stack)

All cards are wide, white, rounded, and have soft shadows.

---

### **Card 1: About You**

- **Left:**  
  - Large circular avatar (Alien head on blue/purple gradient)

- **Right:**  
  - Two input fields:
    - **First name:** “Raja”
    - **Last name:** “Singh”

---

### **Card 2: Email Preferences**

#### **Header Area**
- Dark square icon (white envelope symbol)
- **Email preferences** (bold)
- Subtitle: *Choose the emails you want to receive from us*

**Top Right Button:**  
- **Manage my email preferences** (solid light blue)

#### **Body**
- Input field: **Contact email**  
  Value shown as masked: `r********1@g****.com`

**Bottom Right Button:**  
- **Update** — disabled (light grey background, white text)

---

### **Card 3: Application Language**

#### **Header Area**
- Dark square icon (translation symbol)
- **Application language**
- Subtitle: *Choose your preferred language to use Waalaxy*

#### **Body**
- Full‑width dropdown  
  - UK flag icon  
  - Text: **English**  
  - Down chevron

**Bottom Right Button:**  
- **Update** (disabled)

---

### **Card 4: Affiliation**

#### **Header Area**
- Dark square icon (handshake symbol)
- **Affiliation**
- Subtitle: *Enter your ambassador's affiliation code*

#### **Body**
- Input field: **Affiliation Code (12 characters)**  
  Placeholder: `XXXXXXXXXXXX`

**Bottom Right Button:**  
- **Validate** — disabled

---

## Component 5: Floating Elements (Fixed)

### **Bottom Right**
- Solid blue circular widget  
- White smiling search/chat icon

### **Mid-Right Edge**
- Dark square theme/settings toggle  
- Sun/starburst icon