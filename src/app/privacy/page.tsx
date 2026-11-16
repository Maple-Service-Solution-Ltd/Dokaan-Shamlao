import React from 'react';
import Link from 'next/link';

export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b-2 border-[#3B2314] pb-3">
        <h1 className="text-2xl font-black text-[#C9462C]">গোপনীয়তা নীতি (Privacy Policy)</h1>
        <Link href="/" className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold">
          ← হোমে ফিরুন
        </Link>
      </div>

      <section className="rounded-2xl border-2 border-[#3B2314] bg-white p-4 space-y-3 text-sm font-semibold">
        <p>
          <strong>দোকান সামলাও! (Dokaan Shamlao)</strong> গেমটি <strong>Maple Service Solution Limited</strong> কর্তৃক
          তৈরি একটি ফ্রি ব্রাউজার গেম। আমরা খেলোয়াড়দের গোপনীয়তাকে সর্বোচ্চ গুরুত্ব দিই।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">১. আমরা কী তথ্য সংগ্রহ করি?</h2>
        <p>
          গেমটি খেলার জন্য কোনো অ্যাকাউন্ট রেজিস্ট্রেশন, ফোন নম্বর বা ইমেইল ঠিকানা প্রয়োজন হয় না। আপনার খেলার অগ্রগতি
          (লেভেল, কয়েন, অর্জন) সংরক্ষণের জন্য একটি বেনামী (Anonymous) টোকেন ব্যবহার করা হয়। আপনি চাইলে একটি ডাকনাম
          (Nickname) ও ঐচ্ছিক জেলা নির্বাচন করতে পারেন।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">২. HelloKhata ERP তথ্যের সাথে স্বাধীনতা</h2>
        <p>
          এই গেমটি HelloKhata-এর বাস্তব ব্যবসায়িক হিসাব বা গ্রাহক ডেটাবেস থেকে সম্পূর্ণ আলাদা। গেমের ভেতরের সব পণ্য, দাম ও
          লেনদেন কাল্পনিক।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">৩. অ্যানালিটিক্স ও তথ্য সংরক্ষণ</h2>
        <p>
          গেমের মান উন্নয়নের জন্য লেভেল সম্পন্ন হওয়া, ডেইলি চ্যালেঞ্জ অংশগ্রহণ এবং স্কোর যাচাইয়ের বেনামী লগ সংরক্ষণ করা হয়।
          কোনো ব্যক্তিগত সংবেদনশীল তথ্য সংগ্রহ বা তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।
        </p>
      </section>
    </main>
  );
}
