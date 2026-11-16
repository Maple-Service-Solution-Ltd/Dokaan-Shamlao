import React from 'react';
import Link from 'next/link';

export default function RulesPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b-2 border-[#3B2314] pb-3">
        <h1 className="text-2xl font-black text-[#C9462C]">খেলার নিয়ম (Game Rules)</h1>
        <Link href="/" className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold">
          ← হোমে ফিরুন
        </Link>
      </div>

      <section className="rounded-2xl border-2 border-[#3B2314] bg-white p-4 space-y-3 text-sm font-semibold">
        <h2 className="text-base font-extrabold text-[#3B2314]">১. কীভাবে খেলবেন?</h2>
        <p>
          কাস্টমার দোকানে এসে যা চাইবে, নিচের তাক থেকে সেই পণ্যে ট্যাপ করে ব্যাগে দিন। সব পণ্য দেওয়া হলে কাস্টমারের কাছ থেকে
          টাকা নিন অথবা বড় নোট দিলে সঠিক খুচরা ফেরত দিন।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">২. বিশেষ কাস্টমার ও চ্যালেঞ্জ</h2>
        <p>
          দরদামের কাস্টমারের মেজাজ বুঝে ছাড় দিন, বাকির কাস্টমারের বিশ্বাস (★) ও বাকির সীমা দেখে সিদ্ধান্ত নিন, কিপ্টা কাস্টমার কম
          টাকা দিলে &ldquo;টাকা কম!&rdquo; চাপুন এবং জাল নোট দেখলে &ldquo;জাল নোট!&rdquo; চাপুন।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">৩. স্টক ও বিপদ সামলানো</h2>
        <p>
          মাল ফুরিয়ে গেলে 🛒 বোতামে ট্যাপ করে মহাজনের কাছে অর্ডার দিন এবং বাক্স এলে ট্যাপ করে খুলুন। লোডশেডিং, ছাদের লিক,
          বন্যার পানি বা চোর দেখলে সাথে সাথে চিহ্নিত স্থানে ট্যাপ করুন।
        </p>
      </section>
    </main>
  );
}
