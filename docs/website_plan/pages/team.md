# Team Page

## Layout Architecture Overview

This page preserves the clean, open layout style introduced on the **Inbox page**, using a collapsed sidebar to give maximum width to the central feature card.

- **Background Color:** Light grey/blue (`bg-slate-50`)
- **Layout Structure:**
  - **Primary Sidebar (Left):** Collapsed, icon-only navigation
  - **Main Content Area:** `flex-1`, containing:
    - A top header (floating pill navbar)
    - A wide two-column feature card

---

## Component 1: Primary Sidebar (Collapsed Navigation)

### **Styles**
- Background: **White (`bg-white`)**
- Subtle right border
- Vertical icon stack

### **Items (Top → Bottom)**

- Alien head logo  
- **Home** — inactive  
- **Prospects** — inactive  
- **Campaigns** — inactive  
- **Inbox** — inactive  
- **Team** — **active**  
  - Blue rounded-square background  
  - White briefcase / ID‑card icon

### **Mid & Bottom Sections**
- Upsell widget: Purple gradient square with crown icon  
- Pricing icon  
- Settings icon  
- Demo icon  

---

## Component 2: Top Navbar (Header)

A floating pill-shaped white container positioned at the **top center/right** of the page.

### **Elements**
- **Subscribe** — outline button  
- **Start a campaign** — solid blue button  
- **Credits pill:** “500 credits” (yellow icon)  
- Notification bell  
- **User profile:** “Raja Singh” + dropdown arrow  

---

## Component 3: Main Content Area (“Team”)

### **Page Header**
- `<h1>` **Team**  
- Large, bold, dark text  
- Left-aligned at the top of the main content area

---

## Feature Card (Primary Two-Column Card)

A very wide white card fills most of the screen.

- Rounded corners  
- Soft shadow  
- Divided into **Left Column** (value proposition) and **Right Column** (video)

---

### **Left Column (Value Proposition)**

#### **Title**
- **Easily prospect as a team** (bold, H2 size)

#### **Subtitle**
- *Customize your team now!* (small, grey)

#### **Feature List (Vertical Stack)**  
Each item includes:
- A small icon inside a very light blue rounded square  
- A bold feature title  
- Grey descriptive text  

Features:

1. **Shared statistics**  
   - Icon: Bar chart  
   - *Track your team’s performance in one place.*

2. **Inter-account import and lead transfer**  
   - Icon: Refresh / arrows  
   - *Manage leads from one account to another in just a few clicks.*

3. **Simplified collaboration**  
   - Icon: Chat bubbles  
   - *Easily switch between accounts and manage campaigns.*

4. **Anti-duplicate security**  
   - Icon: User with shield/slash  
   - *Never contact the same person as another team member.*

---

### **CTA Button (Bottom of Left Column)**

A full-width gradient button:

- Purple → cyan/light blue gradient  
- White text: **“Test Waalaxy with my colleagues”**

---

## Right Column (Video Widget)

- Full-height YouTube thumbnail
- Thumbnail features:
  - Smiling woman  
  - Text: **“WAALAXY TEAM”**  
  - Red play button overlay in center

- Bottom-left: **“Watch on YouTube”** dark pill

---

## Component 4: Floating Elements (Fixed)

### **Bottom-Right Corner**
- Solid blue floating chat widget  
- White smiling face icon  