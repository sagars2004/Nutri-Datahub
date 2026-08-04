import React from 'react';
import './globals.css';
import '../styles/nutri-label.css';

export const metadata = {
  title: 'Nutri — Standardized Data Nutrition Facts & Trust Score Platform',
  description: 'A nutrition-label-style Trust Score generator for DataHub catalog entities.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
