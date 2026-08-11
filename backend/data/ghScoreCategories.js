// src/data/ghScoreCategories.js
import {
  CreditCard as CreditCard2,
  Zap as Zap2,
  Shield,
  Home as Home2,
  Users2 as Users22,
  RefreshCw as RefreshCw2,
  Heart,
  BookOpen,
  UtensilsCrossed,
  Brain,
  Handshake,
  Leaf,
  Wallet,
  Moon,
  Droplet,
  ShieldCheck
} from "lucide-react";
var GH_STYLE = `
@keyframes ghScorePop {
  0% { opacity: 0; transform: scale(0.85); }
  60% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ghFloatA { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(-10px) rotate(var(--r)); } }
@keyframes ghFloatB { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(8px) rotate(var(--r)); } }
@keyframes heroCircleSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes pureSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes cardFlipIn {
  0% { transform: rotateX(20deg); opacity: 0.55; }
  100% { transform: rotateX(0deg); opacity: 1; }
}
.card-flip-in { animation: cardFlipIn 0.22s cubic-bezier(.4,.15,.2,1); transform-origin: center top; }
.gh-score-reveal { animation: ghScorePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.gh-float-a { animation-name: ghFloatA; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.gh-float-b { animation-name: ghFloatB; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
`;
var GH_CATEGORIES = [
  {
    key: "self",
    label: "Self",
    blurb: "Mind, body & personal well-being",
    icon: Heart,
    color: "#7C3AED",
    dailyRotation: true,
    items: [
      { key: "health", label: "Health", icon: Heart, type: "yesno", questions: ["Are you healthy?", "Are you feeling good in your body today?", "Are you taking care of your health today?"] },
      { key: "education", label: "Education", icon: BookOpen, type: "math", question: "Quick check \u2014 what's {a} + {b}?" },
      { key: "food", label: "Food", icon: UtensilsCrossed, type: "yesno", questions: ["Are you eating what you love?", "Did you enjoy your last meal?", "Are you eating well today?"] },
      { key: "mental", label: "Mentally", icon: Brain, type: "yesno", questions: ["Are you okay?", "Is your headspace in a good place today?", "Are you feeling mentally well today?"] },
      { key: "sleep", label: "Sleep", icon: Moon, type: "yesno", questions: ["Did you get enough sleep last night?", "Are you sleeping well these days?", "Did you wake up feeling rested?"] }
    ]
  },
  {
    key: "community",
    label: "Community",
    blurb: "People, connections & contribution",
    icon: Handshake,
    color: "#F97316",
    dailyRotation: true,
    items: [
      { key: "belonging", label: "Belonging", icon: Users22, type: "yesno", questions: ["Do you feel you belong where you live?", "Do you feel at home in your community?", "Do you feel accepted where you live?"] },
      { key: "support", label: "Support", icon: Handshake, type: "yesno", questions: ["Do you help others around you?", "Did you help someone today?", "Do you support the people around you?"] },
      { key: "trust", label: "Trust", icon: Shield, type: "yesno", questions: ["Do you trust the people around you?", "Do you feel safe trusting your neighbors?", "Do you generally trust the people you deal with?"] },
      { key: "voice", label: "Voice", icon: BookOpen, type: "math", question: "Quick check \u2014 what's {a} + {b}?" },
      { key: "family", label: "Family", icon: Home2, type: "yesno", questions: ["Do you feel connected to your family?", "Have you connected with family recently?", "Do you feel close to your family?"] }
    ]
  },
  {
    key: "environment",
    label: "Environment",
    blurb: "Planet, resources & sustainability",
    icon: Leaf,
    color: "#14B8A6",
    dailyRotation: true,
    items: [
      { key: "recycling", label: "Recycling", icon: RefreshCw2, type: "yesno", questions: ["Do you recycle regularly?", "Did you recycle today?", "Do you make an effort to recycle?"] },
      { key: "energy", label: "Energy", icon: Zap2, type: "yesno", questions: ["Do you try to save energy at home?", "Did you save energy today?", "Are you mindful about energy use?"] },
      { key: "nature", label: "Nature", icon: Leaf, type: "yesno", questions: ["Do you spend time in nature?", "Did you spend time outdoors today?", "Do you make time for nature regularly?"] },
      { key: "awareness", label: "Awareness", icon: BookOpen, type: "math", question: "Quick check \u2014 what's {a} + {b}?" },
      { key: "water", label: "Water", icon: Droplet, type: "yesno", questions: ["Do you try to conserve water?", "Did you try to save water today?", "Are you mindful about how much water you use?"] }
    ]
  },
  {
    key: "finance",
    label: "Finance",
    blurb: "Money habits & financial health",
    icon: Wallet,
    color: "#EC4899",
    locksAfterAnswer: true,
    items: [
      { key: "savings", label: "Savings", icon: Wallet, type: "yesno", question: "Do you save money regularly?" },
      { key: "budgeting", label: "Budgeting", icon: BookOpen, type: "math", question: "Quick check \u2014 what's {a} + {b}?" },
      { key: "debt", label: "Debt", icon: Shield, type: "yesno", question: "Do you feel in control of your debts?" },
      { key: "security", label: "Security", icon: CreditCard2, type: "yesno", question: "Do you feel financially secure?" },
      { key: "insurance", label: "Insurance", icon: ShieldCheck, type: "yesno", question: "Do you have insurance coverage for emergencies?" }
    ]
  }
];
var GH_DEFAULT_COLORS = GH_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: c.color }), {});
var GH_BLOB_SHAPES = [
  { radius: "63% 37% 54% 46% / 55% 48% 52% 45%", rotate: -8 },
  { radius: "42% 58% 63% 37% / 41% 51% 49% 59%", rotate: 6 },
  { radius: "58% 42% 39% 61% / 63% 41% 59% 37%", rotate: -5 },
  { radius: "37% 63% 47% 53% / 58% 39% 61% 42%", rotate: 9 }
];
var GH_FLOAT_NUMS = [
  { text: "2", top: "6%", left: "6%", size: 30, rotate: -14, color: hexToRgba("#7C3AED", 0.14), anim: "gh-float-a", dur: "5.5s", delay: "0s" },
  { text: "8", top: "9%", right: "7%", size: 20, rotate: 11, color: hexToRgba("#F97316", 0.17), anim: "gh-float-b", dur: "4.8s", delay: "0.4s" },
  { text: "5", top: "65%", left: "4%", size: 38, rotate: 9, color: hexToRgba("#14B8A6", 0.13), anim: "gh-float-a", dur: "6.2s", delay: "0.8s" },
  { text: "4", top: "70%", right: "5%", size: 25, rotate: -9, color: hexToRgba("#EC4899", 0.16), anim: "gh-float-b", dur: "5.1s", delay: "0.2s" },
  { text: "0", top: "2%", left: "40%", size: 17, rotate: 4, color: hexToRgba("#7C3AED", 0.11), anim: "gh-float-a", dur: "5.8s", delay: "1.1s" },
  { text: "3", top: "39%", left: "2%", size: 19, rotate: -7, color: hexToRgba("#F97316", 0.14), anim: "gh-float-b", dur: "4.5s", delay: "0.6s" },
  { text: "1", top: "37%", right: "3%", size: 23, rotate: 7, color: hexToRgba("#14B8A6", 0.14), anim: "gh-float-a", dur: "6.6s", delay: "0.3s" },
  { text: "9", top: "87%", left: "40%", size: 19, rotate: -10, color: hexToRgba("#EC4899", 0.13), anim: "gh-float-b", dur: "5.4s", delay: "0.9s" },
  { text: "6", top: "18%", left: "22%", size: 15, rotate: 6, color: hexToRgba("#F97316", 0.1), anim: "gh-float-a", dur: "5s", delay: "1.4s" },
  { text: "7", top: "24%", right: "20%", size: 16, rotate: -5, color: hexToRgba("#7C3AED", 0.1), anim: "gh-float-b", dur: "6s", delay: "0.5s" }
];

