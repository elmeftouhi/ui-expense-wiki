import React from 'react'
import {
  Apple, Baby, Banknote, Bed, Beer, Bike, BookOpen, Briefcase, Building, Bus, Cake, Calculator, Calendar,
  Camera, Car, Cat, CircleParking, Cloud, Code, Coffee, Coins, CreditCard, Dog, Droplet, Dumbbell, FileText,
  Film, Flame, FolderTree, Fuel, Gamepad2, Gem, Gift, Glasses, Globe, GraduationCap, HandCoins, HandHeart,
  Hammer, Headphones, Heart, HeartPulse, House, Key, Lamp, Landmark, Laptop, Leaf, MapPin, Megaphone, Music,
  Package, Paintbrush, PawPrint, Percent, Phone, PiggyBank, Pill, Pizza, Plane, Plug, Printer, Receipt,
  Recycle, Repeat, Scale, Scissors, Server, Shield, Ship, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa,
  Sparkles, Sprout, Star, Stethoscope, Tag, Ticket, TrainFront, TreePalm, TrendingUp, Trophy, Tv, User, Users,
  Utensils, Wallet, Watch, Wifi, Wine, Wrench, Zap,
} from 'lucide-react'

type IconComponent = React.ComponentType<{ className?: string }>

export interface IconOption {
  /** Stored on the category; never rename an existing entry or saved categories lose their icon. */
  name: string
  icon: IconComponent
  label: string
}

export interface IconGroup {
  label: string
  icons: readonly IconOption[]
}

const option = (name: string, icon: IconComponent, label: string): IconOption => ({ name, icon, label })

export const CATEGORY_ICON_GROUPS: readonly IconGroup[] = [
  {
    label: 'General',
    icons: [
      option('Tag', Tag, 'General / Tag'),
      option('FolderTree', FolderTree, 'Department / Group'),
      option('Star', Star, 'Favorite'),
      option('Package', Package, 'Package'),
      option('Calendar', Calendar, 'Calendar'),
      option('Repeat', Repeat, 'Recurring'),
      option('Sparkles', Sparkles, 'Miscellaneous'),
    ],
  },
  {
    label: 'Home & utilities',
    icons: [
      option('House', House, 'Home'),
      option('Building', Building, 'Facilities & Rent'),
      option('Key', Key, 'Mortgage & Keys'),
      option('Sofa', Sofa, 'Furniture'),
      option('Bed', Bed, 'Bedroom'),
      option('Lamp', Lamp, 'Decor & Lighting'),
      option('Hammer', Hammer, 'Repairs'),
      option('Wrench', Wrench, 'Maintenance'),
      option('Paintbrush', Paintbrush, 'Renovation'),
      option('Flame', Flame, 'Utilities'),
      option('Zap', Zap, 'Electricity'),
      option('Droplet', Droplet, 'Water'),
      option('Plug', Plug, 'Energy'),
      option('Wifi', Wifi, 'Internet'),
      option('Leaf', Leaf, 'Garden'),
      option('Recycle', Recycle, 'Waste & Recycling'),
    ],
  },
  {
    label: 'Food & drink',
    icons: [
      option('ShoppingCart', ShoppingCart, 'Groceries'),
      option('Coffee', Coffee, 'Meals & Food'),
      option('Utensils', Utensils, 'Restaurants'),
      option('Pizza', Pizza, 'Takeaway'),
      option('Apple', Apple, 'Fresh food'),
      option('Cake', Cake, 'Bakery & Treats'),
      option('Wine', Wine, 'Wine & Spirits'),
      option('Beer', Beer, 'Bars'),
    ],
  },
  {
    label: 'Transport & travel',
    icons: [
      option('Car', Car, 'Transportation'),
      option('Fuel', Fuel, 'Fuel'),
      option('CircleParking', CircleParking, 'Parking'),
      option('Bus', Bus, 'Public transport'),
      option('TrainFront', TrainFront, 'Train'),
      option('Bike', Bike, 'Bike'),
      option('Plane', Plane, 'Travel & Flights'),
      option('Ship', Ship, 'Ferry & Cruise'),
      option('TreePalm', TreePalm, 'Holidays'),
      option('MapPin', MapPin, 'Places'),
    ],
  },
  {
    label: 'Health & family',
    icons: [
      option('HeartPulse', HeartPulse, 'Health'),
      option('Stethoscope', Stethoscope, 'Doctor'),
      option('Pill', Pill, 'Pharmacy'),
      option('Dumbbell', Dumbbell, 'Fitness'),
      option('Scissors', Scissors, 'Personal care'),
      option('Baby', Baby, 'Children'),
      option('User', User, 'Personal'),
      option('PawPrint', PawPrint, 'Pets'),
      option('Dog', Dog, 'Dog'),
      option('Cat', Cat, 'Cat'),
      option('Sprout', Sprout, 'Wellbeing'),
    ],
  },
  {
    label: 'Leisure & shopping',
    icons: [
      option('ShoppingBag', ShoppingBag, 'Office Supplies'),
      option('Shirt', Shirt, 'Clothing'),
      option('Watch', Watch, 'Accessories'),
      option('Gem', Gem, 'Jewelry'),
      option('Glasses', Glasses, 'Eyewear'),
      option('Gift', Gift, 'Gifts'),
      option('Film', Film, 'Cinema'),
      option('Tv', Tv, 'Streaming & TV'),
      option('Music', Music, 'Music'),
      option('Headphones', Headphones, 'Audio'),
      option('Gamepad2', Gamepad2, 'Games'),
      option('Ticket', Ticket, 'Events & Tickets'),
      option('Camera', Camera, 'Photography'),
      option('BookOpen', BookOpen, 'Books'),
      option('Trophy', Trophy, 'Sports'),
    ],
  },
  {
    label: 'Money & finance',
    icons: [
      option('CreditCard', CreditCard, 'Banking & Fees'),
      option('Wallet', Wallet, 'Wallet'),
      option('Banknote', Banknote, 'Cash'),
      option('Coins', Coins, 'Coins & Change'),
      option('PiggyBank', PiggyBank, 'Savings'),
      option('Landmark', Landmark, 'Bank & Taxes'),
      option('Receipt', Receipt, 'Bills'),
      option('Percent', Percent, 'Interest & Loans'),
      option('TrendingUp', TrendingUp, 'Investments'),
      option('HandCoins', HandCoins, 'Lending'),
      option('HandHeart', HandHeart, 'Donations'),
      option('Heart', Heart, 'Charity'),
    ],
  },
  {
    label: 'Work & business',
    icons: [
      option('Briefcase', Briefcase, 'Professional Services'),
      option('Users', Users, 'Payroll & HR'),
      option('Laptop', Laptop, 'Hardware & Tech'),
      option('Server', Server, 'Cloud & Infrastructure'),
      option('Cloud', Cloud, 'Cloud services'),
      option('Code', Code, 'Software'),
      option('Smartphone', Smartphone, 'Mobile'),
      option('Phone', Phone, 'Telecom & Internet'),
      option('Printer', Printer, 'Printing'),
      option('Calculator', Calculator, 'Accounting'),
      option('Megaphone', Megaphone, 'Marketing & Ads'),
      option('Shield', Shield, 'Legal & Compliance'),
      option('Scale', Scale, 'Legal'),
      option('FileText', FileText, 'Licenses & Subscriptions'),
      option('GraduationCap', GraduationCap, 'Training & Education'),
      option('Globe', Globe, 'Global Operations'),
    ],
  },
]

export const AVAILABLE_CATEGORY_ICONS: readonly IconOption[] = CATEGORY_ICON_GROUPS.flatMap((group) => group.icons)

export const ICON_MAP: Record<string, IconComponent> = {
  ...Object.fromEntries(AVAILABLE_CATEGORY_ICONS.map((item) => [item.name, item.icon])),
  // Lucide's former name for House; keeps any category saved with it rendering.
  Home: House,
}
