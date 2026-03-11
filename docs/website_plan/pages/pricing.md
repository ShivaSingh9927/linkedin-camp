# Pricing Page

## Layout Architecture Overview

The Pricing page uses a clean, centered layout to highlight the subscription tiers.

- **Background Color:** Light grey/blue (`bg-slate-50`)
- **Layout Structure:**
  - **Primary Sidebar (Left):** Collapsed, icon-only navigation
  - **Main Content Area:** `flex-1`, full width, centered layout for:
    - Page headline
    - Billing toggle
    - Grid of pricing cards

---

## Component 1: Primary Sidebar (Collapsed Navigation)

### **Styles**
- Background: **White** (`bg-white`)
- Subtle right border
- Vertical icon-only layout

### **Items (Top → Bottom)**

- Alien head logo  
- **Home** — inactive  
- **Prospects** — inactive  
- **Campaigns** — inactive  
- **Inbox** — inactive  
- **Team** — inactive  

### **Bottom Section**
- **Pricing** — **active** (vibrant blue/purple rounded-square background, crown icon)
- Settings icon (inactive)  
- Demo icon (inactive)  

---

## Component 2: Top Navbar (Header)

A floating, pill-shaped white navbar aligned toward the **top center/right**.

### **Elements**
- **Subscribe** — outline button  
- **Start a campaign** — solid blue  
- **Credits pill:** “500 credits”  
- Notification bell  
- **User Profile:** “Raja Singh” dropdown  

---

## Component 3: Main Content Area – Header & Toggles

### **Page Headline**
- `<h1>` **Join LEADMATE – best prices in the galaxy 😎**  
- Centered, bold, dark text

---

### **Billing Cycle Toggle**
A pill-shaped segmented toggle centered below the headline.

Options:

1. **Monthly**  
2. **Quarterly**  
3. **Yearly**  
   - Includes purple **“Save 50%”** badge

---

## Component 4: Pricing Cards Grid (4 Columns)

A horizontal flex/grid layout featuring **four pricing tiers**, each a white rounded card with subtle shadow.

---

### **Card 1: PRO**

- **Header:** **PRO** (bold)
- **Subtext:**  
  *Ideal if you have a strong LinkedIn network and want to turn connections into conversations.*
- **Price Area:**  
  - ₹431  
  - ₹885/month (crossed out)
- **Seat Counter:**  
  `- 1 + member`
- **Action Button:**  
  **Choose this plan** (outline; blue text + border)
- **Limits Badge:**  
  Light grey pill — *300 invitations per month*
- **Feature List:**  
  **Key Features:**  
  - Automated follow-up messages  
  - LinkedIn Campaigns  
  - And more…

---

### **Card 2: ADVANCED (Upsell / Highlighted)**

#### **Styling Differences**
- Slightly elevated (raised)
- Solid blue border
- 3D rocket icon breaking from top-right
- Blue badge on top: **“x2.5 more results than PRO ★”**

#### **Content**
- **Header:** **ADVANCED** (bold, blue)
- **Subtext:**  
  *Perfect for scaling outreach and growing your network fast – at the best price.*
- **Price Area:**  
  - ₹1,271  
  - ₹2,541/month (crossed out)
- **Seat Counter:**  
  `- 1 + member`
- **Action Button:**  
  Gradient purple → cyan, white text: **Choose this plan**
- **Limits Badge:**  
  Light blue pill — *800 invitations per month*
- **Feature List:**  
  **← Everything in PRO plus:**  
  - +500 Invitations  
  - Live Chat support  
  - API Keys Management  

---

### **Card 3: BUSINESS**

- **Header:** **BUSINESS**
- **Subtext:**  
  *Maximize replies by combining LinkedIn and Emails. No leads left behind.*
- **Price Area:**  
  - ₹1,815  
  - ₹3,629/month (crossed out)
- **Seat Counter:**  
  `- 1 + member`
- **Action Button:**  
  **Current trial** (outline button)
- **Limits Badge:**  
  Grey pill — *800 invitations per month*
- **Feature List:**  
  **← Everything in ADVANCED plus:**  
  - Cold Email features  
  - Email finders  
  - Additional outreach tools  

---

### **Card 4: ENTERPRISE**

- **Header:** **ENTERPRISE**
- **Subtext:**  
  *Designed for collaboration, for sales teams and agencies.*
- **Price Area:**  
  **Custom**  
  - Subtext: *Starts at 5 seats*
- **Action Button:**  
  **Talk to Sales** (outline)
- **Limits Badge:**  
  Grey pill — *800 invitations per month*
- **Feature List:**  
  **← The plan you choose, plus:**  
  - Team workspace  
  - Volume discounts  
  - Unified billing  

---

## Component 5: Floating Elements (Fixed)

### **Bottom Right**
- Solid blue circular floating widget  
- White smiling search/chat icon  

### **Mid-Right Edge**
- Dark square theme/settings toggle  
- Sun/starburst icon  