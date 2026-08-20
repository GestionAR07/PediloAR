[1mdiff --git a/src/app/merchant/merchant-navigation.static.test.ts b/src/app/merchant/merchant-navigation.static.test.ts[m
[1mindex 9430de8..d3aa174 100644[m
[1m--- a/src/app/merchant/merchant-navigation.static.test.ts[m
[1m+++ b/src/app/merchant/merchant-navigation.static.test.ts[m
[36m@@ -17,8 +17,10 @@[m [mdescribe("merchant back navigation", () => {[m
     // Single-membership resolver still lives on /merchant index.[m
     expect(page).not.toMatch(/href=["']\/merchant["']/);[m
     expect(page).toContain("Gestionar catálogo");[m
[32m+[m[32m    expect(page).toContain("Portada del comercio");[m
     expect(page).toContain("Medios de pago");[m
     expect(page).toContain("Envíos y zonas");[m
[32m+[m[32m    expect(page).toContain("href={`/merchant/${merchantId}/profile`}");[m
     expect(page).toContain("href={`/merchant/${merchantId}/payment-methods`}");[m
     expect(page).toContain("href={`/merchant/${merchantId}/delivery`}");[m
   });[m
[36m@@ -38,6 +40,13 @@[m [mdescribe("merchant back navigation", () => {[m
     expect(page).toContain("href={`/merchant/${merchantId}/catalog`}");[m
   });[m
 [m
[32m+[m[32m  it("profile cover returns to the merchant dashboard", () => {[m
[32m+[m[32m    const page = read("src/app/merchant/[merchantId]/profile/page.tsx");[m
[32m+[m[32m    expect(page).toContain("← Mi comercio");[m
[32m+[m[32m    expect(page).toContain("href={`/merchant/${merchantId}`}");[m
[32m+[m[32m    expect(page).toContain("Portada del comercio");[m
[32m+[m[32m  });[m
[32m+[m
   it("payment methods returns to the merchant dashboard", () => {[m
     const page = read("src/app/merchant/[merchantId]/payment-methods/page.tsx");[m
     expect(page).toContain("← Mi comercio");[m
