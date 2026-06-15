import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'BITTE-IN-PRODUKTION-AENDERN',
  publicUrl: process.env.PUBLIC_URL || '', // z.B. https://pr.deine-domain.de
};
