# Winzen International Limited - AI Training Rules

This document outlines structural formatting, localization, and domain-specific rules for training vision and language models (like Claude or Gemini) on Winzen Apparel's physical sample tags.

## Naming & Corporate Identity
* **Corporate Entity Rule:** When the physical tag reads "Winzen Apparel Limited", the AI MUST default to extracting and displaying "Winzen International Limited". The former is a legacy name and should be dynamically replaced.

## Terminology & Abbreviations
* **Style Number:** The legacy field "Y STYLE NO" should always be mapped to "STYLE NO". 
* **Sleeve Types:** The abbreviation "S/SLV" must be explicitly expanded to "Short Sleeve". Do not output "S/SLV".

## Localization & Translation (English <-> Traditional Chinese)
When generating dual-language UI or outputting translations, enforce these strict mapping rules:
* "Single Jersey" -> "Single Jersey (平紋)"
* "BUYER" -> "客人"
* "SEASON" -> "季節"
* "SALES" -> "營業員"
* "CUST. STYLE NO." -> "客款號"
* "STYLE NO" -> "款式編號"
* "GARMENT TYPE" -> "樣辦類型"
* "WASHING" -> "洗滌方式"
* "RAW FABRIC TEXT" -> "布料原文"
* "G.N.W." -> "重量"
* "YARN COUNT" -> "紗支"
* "MATERIAL" -> "成份"
* "CONSTRUCTION" -> "組織"
* "SAMPLE Job No." -> "辦單號"
* "COLOR" -> "顏色"
* "SIZE" -> "尺碼"
* "DESCRIPTION" -> "內容描述"
* "REMARK / MEMO" -> "備註"
* "HASHTAGS" -> "標籤"
* "PRINT DATETIME" -> "列印時間"

## Process Workflows (Dyeing & Treatments)
* **Reactive & Tie Dye Workflow:** If a tag indicates both reactive dye and tie-dye on a single garment, format the memo strictly as: "First reactive dye on garment, then tie dye also using reactive dye." 
* **Hashtags Generation:** The AI should intelligently append hashtags based on detected processes. Example: `#garment_dye, #tie_dye`.
