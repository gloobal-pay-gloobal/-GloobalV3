// src/screens/Banks/AddBankScreen.jsx
import { useState as useState13, useMemo as useMemo4 } from "react";
import {
  Search as Search2,
  Lock as Lock3,
  ChevronRight as ChevronRight3,
  Star,
  Shield as Shield2,
  ArrowLeft as ArrowLeft3,
  Landmark as Landmark4
} from "lucide-react";


// src/screens/Banks/AddBankScreen.jsx
function AddBankScreen({ onClose, country: countryProp }) {
  // The screen reads country.iso / .name / .flag in a dozen places and
  // assumed the prop was always supplied — opening it before a country
  // was resolved threw on the first read and blanked the screen.
  // Normalising once here keeps every downstream reference unchanged.
  const country = countryProp || COUNTRY_BY_ISO?.IN || ALL_COUNTRIES?.[0] || { iso: "IN", name: "India", flag: "🇮🇳" };
  const [query, setQuery] = useState13("");
  const [toast, setToast] = useState13(null);
  const countryBanks = BANKS_BY_COUNTRY[country.iso] || [];
  const gloobalBank = useMemo4(() => buildGloobalBank(country), [country]);
  const filteredCountryBanks = useMemo4(() => {
    if (!query.trim()) return countryBanks;
    const q = query.toLowerCase();
    return countryBanks.filter((b) => b.name.toLowerCase().includes(q));
  }, [query, countryBanks]);
  const searching = query.trim().length > 0;
  const onLockedTap = () => {
    setToast("Locked until live APIs connect");
    setTimeout(() => setToast(null), 2200);
  };
  return <div
    className="bg-white flex flex-col font-sans"
    style={{ position: "fixed", inset: 0, zIndex: 250 }}
  ><style>{`
        @keyframes abBankListIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ab-bank-row { animation: abBankListIn 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .ab-bank-row { animation: none !important; } }
      `}</style>{
    /* Header — country is fixed to the person's registered country: a
       display-only flag, no name, no picker, nothing tappable. */
  }<div
    className="px-4 pb-3 flex items-center gap-2.5 border-b border-slate-100"
    style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }}
  ><button
    onClick={onClose}
    aria-label="Close"
    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all flex-shrink-0"
  ><ArrowLeft3 size={19} className="text-slate-700" /></button><div
    aria-label="Your registered country"
    className="flex items-center justify-center bg-slate-100 rounded-2xl px-3 py-2.5 flex-shrink-0"
  ><FlagEmoji flag={country.flag} width={24} height={18} radius={5} /></div><div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/30 transition-all"><Search2 size={17} className="text-slate-400 flex-shrink-0" /><input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search bank name"
    className="bg-transparent outline-none text-[14.5px] text-slate-700 placeholder:text-slate-400 w-full"
  /></div></div><div className="flex-1 overflow-y-auto pb-6" style={{ scrollbarWidth: "none" }}>{!searching && <div className="relative pt-2 pb-8 overflow-hidden bg-gradient-to-b from-sky-50 via-sky-50/40 to-transparent"><div className="absolute -right-24 -top-16 z-0"><GlobeHero size={340} /></div>{
    /* soft fade so the globe blends into the white content below, like the reference */
  }<div
    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"
    style={{ zIndex: 1 }}
  /><div className="relative z-10 px-6 max-w-[210px]"><div className="flex items-center gap-1.5 mb-4"><div className="w-7 h-[3px] bg-violet-600 rounded-full" /><div className="w-1.5 h-1.5 bg-violet-300 rounded-full" /></div><h1 className="text-[32px] font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                Bank globally.
              </h1><h1 className="text-[32px] font-extrabold text-violet-600 leading-[1.1] tracking-tight mb-3">
                One ID for all.
              </h1><p className="text-slate-500 text-[14px] leading-relaxed">
                Link your bank account securely and create your <GloobalWordmark suffix=" ID" /> instantly.
              </p></div></div>}<div key={country.iso} className="px-5 flex flex-col gap-3">{
    /* Gloobal Bank — always first, regardless of country or search */
  }<BankRow bank={gloobalBank} index={0} accent onLockedTap={onLockedTap} />{
    /* Country-specific top 5 */
  }<div className="flex items-center gap-2 mt-1 mb-0.5"><div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Star size={10} className="text-white fill-white" /></div><span className="font-bold text-slate-900 text-[15px] tracking-tight">{searching ? `Results for "${query}"` : `Top 5 banks in ${country.name}`}</span></div>{countryBanks.length === 0 && <p className="text-slate-400 text-[13.5px] py-1">
              No additional banks currently supported for {country.name}.
            </p>}{filteredCountryBanks.map((bank, i) => <BankRow key={bank.id} bank={bank} index={i + 1} onLockedTap={onLockedTap} />)}{searching && countryBanks.length > 0 && filteredCountryBanks.length === 0 && <p className="text-slate-400 text-[13.5px] py-1">No banks found for "{query}".</p>}{!searching && <button
    onClick={onLockedTap}
    aria-label="Other bank — locked"
    className="ab-bank-row relative w-full flex items-center gap-4 px-4 py-4 rounded-3xl border border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 active:scale-[0.99] transition-all text-left"
    style={{ animationDelay: `${(filteredCountryBanks.length + 1) * 45}ms` }}
  ><div className="w-[54px] h-[54px] rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Landmark4 size={22} className="text-slate-400" /></div><span className="flex-1 text-slate-500 text-[15.5px] font-semibold">Other bank</span><ServiceLock size={18} /></button>}</div>{!searching && <div className="px-5 mt-5"><div className="w-full flex items-center gap-3 bg-gradient-to-r from-violet-50 to-violet-100 rounded-2xl px-4 py-3.5 border border-violet-100/60"><div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center"><Shield2 size={24} className="text-violet-600 fill-violet-100" /><Lock3 size={11} className="text-violet-700 absolute bottom-0 right-0" /></div><div className="flex-1"><p className="font-bold text-slate-900 text-[14px]">Your security is our priority</p><p className="text-slate-500 text-[12px] leading-snug">Bank-grade encryption &amp; secure onboarding</p></div><ChevronRight3 size={17} className="text-slate-400 flex-shrink-0" /></div></div>}</div>{toast && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">{toast}</div>}</div>;
}
function BankRow({ bank, index, accent, onLockedTap }) {
  return <button
    onClick={() => onLockedTap(bank)}
    aria-label={`${bank.name} \u2014 locked`}
    className={`ab-bank-row relative w-full flex items-center gap-4 px-4 py-4 rounded-3xl border text-left transition-all ${accent ? "border-violet-100 bg-gradient-to-r from-blue-50/70 to-violet-50/70 shadow-sm hover:shadow-md active:scale-[0.99]" : "border-slate-100 bg-white shadow-sm hover:shadow-md active:scale-[0.99]"}`}
    style={{ animationDelay: `${index * 45}ms` }}
  ><BankAvatar bank={bank} size={54} /><span className="flex-1 min-w-0 text-slate-800 text-[15.5px] font-semibold truncate">{bank.isGloobal ? <GloobalWordmark suffix=" Bank" /> : bank.name}</span><ServiceLock size={18} /></button>;
}

