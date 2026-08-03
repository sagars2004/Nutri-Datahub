import React from 'react';
import '../styles/nutri-label.css';

export const metadata = {
  title: 'Nutri - DataHub Trust Score & Nutrition Label Generator',
  description: 'A nutrition-label-style Trust Score generator for DataHub catalog entities.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
