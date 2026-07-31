# Dokion Architecture Reference

## 1. Overview
Dokion is a monolithic, vertically-sliced fullstack architecture. It couples Next.js App Router with a strongly-typed service layer to ensure that UI, API, and database schemas remain synchronized. The design prioritizes colocation, progressive enhancement, and fail-fast validation.

## 2. System Context
