# Home Page

## Layout Architecture Overview

The page utilizes a classic SaaS layout:

- **Background Color:** Very light grey/blue (`bg-slate-50` or `bg-gray-50`).
- **Layout Structure:** A full-height flex container.
- **Left Sidebar:** Fixed width (approx. 240–280px), full height.
- **Main Content Wrapper:** `flex-1` (takes remaining width), containing:
  - **Top Navbar:** Fixed height at the top.
  - **Dashboard Content:** A CSS Grid or flex row splitting:
    - **Center content:** ~65% width
    - **Right-hand widget column:** ~35% width

---

## Component 1: Left Sidebar (Navigation)

A white (`bg-white`) sidebar with a subtle right border, using a vertical flex layout to push footer links to the bottom.

### **Top Section (Brand)**
- **Logo:** LEADMATE alien head (brand blue)
- **Text:** “WAALAXY”
- **Chevron:** Downward chevron for workspace/account dropdown

### **Main Menu Items (Nav Links)**

> **Design note:**  
> Each item has an icon on the left and text centered.  
> - **Active state:** white background, subtle shadow, blue text/icon  
> - **Inactive state:** dark grey icons and text  

- **Home** — *Active* (rounded white card with subtle shadow, blue home/dashboard icon)
- **Prospects** — *Inactive* (ID card/contact icon)
- **Campaigns** — *Inactive* (Rocket icon + right chevron indicating submenu)  
  Sub-items:
  1. Campaign list  
  2. Message template  
  3. Queue
- **Inbox** — *Inactive* (Chat bubble icon)
- **Team** — *Inactive* (Multiple users icon)

---

### **Mid Section (Upsell Widget)**

A promotional widget encouraging upgrades.

- **Wrapper:** Rounded rectangular card with faint border/shadow
- **Icon:** Square with blue-purple gradient + white crown icon
- **Title:** **Subscribe** (bold)
- **Subtitle:** *Your free trial will end in 6 days*
- **Button:** Full-width light-blue button labeled **Subscribe**

---

### **Bottom Menu Items**
- Pricing (crown icon)
- Settings (gear icon)
- See Demo (play icon)

### **Footer Links**
Small text at the bottom:
- Privacy
- Terms & Conditions

---

## Component 2: Top Navbar (Header)

A full-width header bar (excluding sidebar), aligned to the right.

### **Right-Aligned Action Group**
- **Subscribe** — outline button (blue border + blue text)
- **Start a campaign** — solid brand-blue button with rocket icon
- **Credit Pill:** Rounded pill with yellow/grey background + coin icon + **500 credits**
- **Notification:** Bell icon
- **User Profile:** “Raja Singh” + dropdown chevron

---

## Component 3: Main Content Area (Center Column)

### **Header**
- **Greeting:** `Hello Raja,` (large, bold `<h1>`)

---

### **Steps for Success Card (Onboarding Component)**

A large rounded white card with soft shadow.

#### **Card Header**
- Trophy icon + **Steps for Success**

#### **Progress Indicator**
- **Text:** “1 task on 3 completed” (left)  
- **Percentage:** “33%” (right)  
- **Progress Bar:** Horizontal bar with 33% blue fill, remainder grey

#### **List Items (Tasks)**

1. **Completed Task**
   - Checked square (light blue background, white check)
   - Icon: Chrome browser
   - Text: *Install LEADMATE Chrome extension* (grey, strikethrough)

2. **Pending Task**
   - Empty square checkbox  
   - Icon: Database / server rings  
   - Title: **Complete my lists**  
   - Sub-link: *See tutorial* (blue text + external link icon)  
   - Button: **Import profiles** (solid blue, right aligned)

3. **Pending Task**
   - Empty checkbox  
   - Icon: Rocket  
   - Title: **Contact profiles**  
   - Sub-link: *See GIF tutorial* (blue text + down chevron)  
   - Button: **Start a campaign** (solid blue, right aligned)

---

## Component 4: Right Sidebar (Widgets)

### **Widget 1: Video Tutorial Card**
- White rounded card with shadow
- YouTube thumbnail:
  - Person image + “FIRST CAMPAIGN WAALAXY TUTORIAL”
  - Red YouTube play button overlay
- Footer text: **Getting started on LEADMATE in 5 min 🚀**

---

### **Widget 2: Support / Help Card**
- White rounded card with shadow
- **Header:** Blue chat bubble icon + **Talk to us**
- **Body:**  
  *“Need any help? Talk to us directly through chat. Click on the blue bubble at the bottom right.”*
- **Action Link:** Blue arrow icon + **Open the chat**

---

## Component 5: Floating Elements (Fixed Positioning)

### **Bottom Right Chat Widget**
- Circular FAB  
- Solid brand blue background  
- White smiling face/chat bubble icon

### **Mid-Right Edge Widget**
- Small dark square on right edge  
- Sun/starburst icon  
- Likely theme toggle or quick settings menu