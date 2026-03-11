# Inbox Page

## Layout Architecture Overview

This page removes the secondary sidebar and focuses entirely on a **centered onboarding experience**.

- **Background Color:** Light grey/blue (`bg-slate-50`).
- **Layout Structure:**
  - **Primary Sidebar:** Collapsed, icon‑only, far left.
  - **Main Content Area:** `flex-1`, centered column layout for headline + feature card.
  - **Decorative Element:** Tilted graphic of a chat UI positioned absolutely on the left edge.

---

## Component 1: Primary Sidebar (Collapsed Navigation)

### **Styles**
- Background: **White**
- Subtle right border
- Icon‑only layout with vertically stacked items

### **Navigation Items (Top → Bottom)**

- Alien head logo (no text)
- **Home** — inactive  
- **Prospects** — inactive  
- **Campaigns** — inactive  
- **Inbox** — **active** (blue rounded-square background, white chat bubble icon)
- **Team** — inactive  

### **Mid & Bottom Sections**
- Upsell widget: Purple gradient square with crown icon  
- Pricing icon  
- Settings icon  
- Demo icon  

---

## Component 2: Top Navbar (Header)

A floating, pill‑shaped white container positioned in the top‑right area.

### **Elements**
- **Subscribe** — outline button  
- **Start a campaign** — solid blue CTA  
- **Credits pill** — “500 credits” with yellow icon  
- Notification bell icon  
- **User Profile:** “Raja Singh” + dropdown chevron  

---

## Component 3: Main Content Area (Promotional Onboarding)

### **Decorative Graphic**
- A tilted floating mockup of a chat interface  
- Positioned at the **top-left**, overlapping the sidebar

---

### **Main Headlines (Centered)**
- **“LinkedIn messaging.”** — large, dark text  
- **“Only better.”** — large, brand‑blue text  

---

## Feature Card (Primary Onboarding Card)

A large white card with rounded corners and a soft shadow, divided into **two columns**:

---

### **Left Column (Features)**

#### **Card Header**
- Title: **Test the Inbox for free**  
- Icon: Blue chat bubble emoji

#### **Subtext**
*“500 conversations managed at no cost and with no time limit!”*

#### **Feature List**
Vertical stack of items:

1. **Templates**  
   - Icon: Disk / Save  
   - Subtext: *Don't rewrite for nothing, save time*

2. **Scheduled messages**  
   - Icon: Calendar / Arm  
   - Subtext: *Send your follow-ups at a specific date*

3. **Conversation reminders**  
   - Icon: Bell  
   - Subtext: *Bring up conversations at a specific date*

4. **Prospects’ tags**  
   - Icon: Pencil / Tag  
   - Subtext: *Organize your Inbox the way you want*

#### **CTA Button**
- **Test Inbox for free 😎** — bright blue CTA  
- *“No credit card required”* (small italic text)

---

### **Right Column (Video Widget)**

- YouTube thumbnail with red play button overlay  
- Thumbnail text: **“WAALAXY INBOX TUTORIAL”**  
- **Caption:** *Take your first steps!* (bold, centered)

---

### **Footer Text (Centered)**
*“Want to know more about LEADMATE’s Inbox? **It’s over here**”*  
(Last portion is a hyperlink-style bold text)

---

## Component 4: Floating Elements (Fixed)

- **Bottom-Right:** Solid blue circular chat widget with white smiling face icon