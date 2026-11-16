import React from 'react';
import Link from 'next/link';

export default function TermsPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b-2 border-[#3B2314] pb-3">
        <h1 className="text-2xl font-black text-[#C9462C]">ব্যবহারের শর্তাবলি (Terms of Use)</h1>
        <Link href="/" className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold">
          ← হোমে ফিরুন
        </Link>
      </div>

      <section className="rounded-2xl border-2 border-[#3B2314] bg-white p-4 space-y-3 text-sm font-semibold">
        <p>
          <strong>দোকান সামলাও! (Dokaan Shamlao)</strong> বিনোদনের জন্য তৈরি একটি ফ্রি-টু-প্লে ব্রাউজার গেম।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">১. কাল্পনিক অর্থনীতি</h2>
        <p>
          গেমের সব টাকা (৳), কয়েন, বাকি, লাভ-ক্ষতি ও পণ্যের দাম সম্পূর্ণ কাল্পনিক খেলার উপাদান। এগুলো কোনো আর্থিক পরামর্শ নয়
          এবং বাস্তব অর্থের সাথে বিনিময়যোগ্য নয়।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">২. ফেয়ার প্লে ও অ্যান্টি-চিট</h2>
        <p>
          লিডারবোর্ডের সব স্কোর সার্ভারে অ্যাকশন-লগ রিপ্লে করে যাচাই করা হয়। স্ক্রিপ্ট, বট বা পরিবর্তিত রিকোয়েস্ট পাঠালে সেই
          স্কোর স্বয়ংক্রিয়ভাবে বাতিল হবে।
        </p>
        <h2 className="text-base font-extrabold text-[#3B2314]">৩. শালীন নাম ব্যবহার</h2>
        <p>
          লিডারবোর্ডে প্রদর্শনের জন্য অশালীন নাম, ফোন নম্বর বা ইমেইল ঠিকানা ব্যবহার নিষিদ্ধ।
        </p>
      </section>
    </main>
  );
}
