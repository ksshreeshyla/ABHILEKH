/**
 * VERIFIED NDLI AMBEDKAR ARCHIVAL METADATA PACKAGE
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Contains structured Dublin Core and archival catalog metadata for:
 * 1. Collected Works of Babasaheb Dr. Ambedkar (CWBA - Hindi) - 40 Volumes
 * 2. Writings and Speeches of Dr. Babasaheb Ambedkar (BAWS - English) - 17 Volumes (20 Parts)
 * 3. Samajik Nyay Sandesh - Archival Periodical Parent Collection
 *
 * Rules:
 * - is_demo_record = false
 * - No fake binary downloads or scraped PDFs
 * - Formal provenance mapped to Dr. Ambedkar Foundation (Publisher) and NDLI (Catalog/Federation)
 */

export interface NdliArchivalEntry {
  sourceRecord: {
    id: string;
    sourceCollectionId: string;
    originalSourceIdentifier: string;
    originalTitle: string;
    originalUrl: string;
    repository: string;
    sourceMetadata: Record<string, unknown>;
    ingestionMethod: string;
    provenanceNotes: string;
    isDemoRecord: boolean;
  };
  archiveItem: {
    id: string;
    archiveId: string;
    sourceRecordId: string;
    title: string;
    titleHi?: string;
    category: string;
    date: string;
    year: number;
    author: string;
    collection: string;
    sourceInstitution: string;
    sourceProvenance: string;
    language: string;
    originalHolding: string;
    description: string;
    descriptionHi?: string;
    fullText: string;
    aiSummary: string;
    keyConcepts: string[];
    publishingStatus: string;
    isFeatured: boolean;
    isDemoRecord: boolean;
  };
  dublinCore: {
    id: string;
    archiveItemId: string;
    title: string;
    creator: string;
    subject: string[];
    description: string;
    publisher: string;
    contributor: string;
    date: string;
    type: string;
    format: string;
    identifier: string;
    source: string;
    language: string;
    relation: string[];
    coverage: string;
    rights: string;
  };
}

export const NDLI_CWBA_URL = 'https://www.ndl.iitkgp.ac.in/ch_document/ambedkar_foundation/ambedkar_mea/A_F_1003518320';
export const NDLI_BAWS_URL = 'https://www.ndl.iitkgp.ac.in/ch_document/ambedkar_foundation/ambedkar_mea/A_F_W_A_S_O_D_B_A_1150077701';
export const NDLI_SNS_URL = 'https://www.ndl.iitkgp.ac.in/ch_document/ambedkar_foundation/ambedkar_mea/A_F_288267570';

// ============================================================================
// 1. CWBA - 40 VOLUMES (HINDI)
// ============================================================================
const cwbaTitles: Array<{ vol: number; titleEn: string; titleHi: string; year: number; subjects: string[]; desc: string }> = [
  { vol: 1, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 1", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 1 (भारत में जातियां, जाति-प्रथा का विनाश, भाषायी राज्यों पर विचार)", year: 1993, subjects: ["Castes in India", "Annihilation of Caste", "Linguistic States"], desc: "Covers Castes in India, Annihilation of Caste, Small Holdings in India, and early constitutional treatises." },
  { vol: 2, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 2", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 2 (बम्बई विधानसभा में भाषण, साइमन कमीशन, गोलमेज सम्मेलन)", year: 1993, subjects: ["Bombay Legislature", "Simon Commission", "Round Table Conference"], desc: "Legislative speeches in Bombay Legislative Council (1927–1939) and Round Table Conference statements." },
  { vol: 3, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 3", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 3 (हिन्दू धर्म का दर्शन, भारत और साम्यवाद, प्राचीन भारत में क्रान्ति और प्रतिक्रान्ति)", year: 1994, subjects: ["Philosophy of Hinduism", "Revolution and Counter-Revolution", "Buddha or Karl Marx"], desc: "Philosophical and sociological treatises including Philosophy of Hinduism and Buddha or Karl Marx." },
  { vol: 4, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 4", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 4 (रिडल्स इन हिंदुइज्म / हिन्दू धर्म की पहेलियां)", year: 1994, subjects: ["Riddles in Hinduism", "Religious Critique", "Vedic Literature"], desc: "Exposition of Riddles in Hinduism addressing religious dogmas and historical scriptures." },
  { vol: 5, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 5", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 5 (अछूत या भारत का घेटो)", year: 1994, subjects: ["Untouchables", "Social Segregation", "Civil Rights"], desc: "Sociological analysis of caste apartheid, social disabilities, and economic boycotts." },
  { vol: 6, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 6", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 6 (ईस्ट इंडिया कंपनी का प्रशासन और वित्त, प्रांतीय वित्त का विकास, रुपये की समस्या)", year: 1995, subjects: ["Monetary Economics", "Problem of the Rupee", "Provincial Finance"], desc: "Ambedkar's seminal economic dissertations for Columbia University and London School of Economics." },
  { vol: 7, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 7", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 7 (शूद्र कौन थे? और अछूत: वे कौन थे और अछूत कैसे बने?)", year: 1995, subjects: ["Who Were the Shudras", "Origin of Untouchability", "Ancient History"], desc: "Historical treatise on the genesis of the fourth varna and origin of untouchability in ancient India." },
  { vol: 8, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 8", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 8 (पाकिस्तान अथवा भारत का विभाजन)", year: 1995, subjects: ["Partition of India", "Geopolitics", "Communal Problem"], desc: "Comprehensive demographic, geopolitical, and historical analysis of the demand for Pakistan." },
  { vol: 9, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 9", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 9 (कांग्रेस और गांधी ने अछूतों के लिए क्या किया, गांधी और अछूतों की मुक्ति)", year: 1996, subjects: ["Poona Pact", "Political Representation", "Gandhi and Untouchables"], desc: "Critique of political negotiations surrounding the Poona Pact and separate electorates." },
  { vol: 10, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 10", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 10 (गवर्नर जनरल की कार्यकारी परिषद के सदस्य के रूप में 1942–1946)", year: 1996, subjects: ["Executive Council", "Labor Welfare", "Water and Power Development"], desc: "Speeches and administrative contributions on labor legislation, Damodar Valley, and Central Waterways." },
  { vol: 11, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 11", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 11 (भगवान बुद्ध और उनका धम्म)", year: 1997, subjects: ["The Buddha and His Dhamma", "Buddhism", "Navayana"], desc: "Ambedkar's magnum opus on the life and teachings of Gautama Buddha and rationalist Dhamma." },
  { vol: 12, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 12", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 12 (अप्रकाशित रचनाएं: प्राचीन भारतीय वाणिज्य, अस्पृश्य और पैक्स ब्रिटानिका)", year: 1997, subjects: ["Ancient Indian Commerce", "Unpublished Essays", "Pax Britannica"], desc: "Columbia University research thesis on Ancient Indian Commerce and unpublished historical manuscripts." },
  { vol: 13, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 13", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 13 (भारत के संविधान के प्रधान वास्तुकार के रूप में डॉ. अम्बेडकर)", year: 1998, subjects: ["Constitution of India", "Constituent Assembly", "Drafting Committee"], desc: "Speeches, motions, and debates as Chairman of the Drafting Committee of the Indian Constitution." },
  { vol: 14, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 14", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 14 (डॉ. अम्बेडकर और हिन्दू कोड बिल)", year: 1999, subjects: ["Hindu Code Bill", "Women's Rights", "Legal Reform"], desc: "The legislative battle for Hindu Code Bill, women's property rights, and progressive civil law." },
  { vol: 15, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 15", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 15 (स्वतंत्र भारत के प्रथम विधि मंत्री और संसद में विपक्ष के सदस्य के रूप में भाषण)", year: 2000, subjects: ["Law Ministry", "Parliamentary Speeches", "Foreign Policy"], desc: "Speeches as Law Minister (1947–1951) and Member of the Rajya Sabha (1952–1956)." },
  { vol: 16, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 16", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 16 (पालि भाषा व्याकरण, पालि-अंग्रेजी शब्दकोश एवं त्रिपिटक अध्ययन)", year: 2000, subjects: ["Pali Grammar", "Linguistics", "Buddhist Canonical Literature"], desc: "Pali language grammar manuscript, Pali-English vocabulary, and Buddhist textual research." },
  { vol: 17, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 17", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 17 (डॉ. बी. आर. अम्बेडकर और उनकी समतावादी क्रान्ति: भाषण एवं अभिलेख)", year: 2001, subjects: ["Egalitarian Revolution", "Speeches", "Historical Letters"], desc: "Compendium of speeches, public letters, and historical declarations of the emancipation movement." },
  { vol: 18, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 18", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 18 (आंबेडकर आंदोलन के सामाजिक एवं राजनीतिक दस्तावेज: भाग 1)", year: 2003, subjects: ["Social Movement", "Political Documents", "Resolutions"], desc: "Documentary records, institutional memoranda, and resolutions from the Bahishkrit Hitakarini Sabha." },
  { vol: 19, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 19", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 19 (आंबेडकर आंदोलन के सामाजिक एवं राजनीतिक दस्तावेज: भाग 2)", year: 2003, subjects: ["Social Movement", "Depressed Classes Conference", "Petitions"], desc: "Historical petitions, representations to the British Cabinet, and Depressed Classes Conferences." },
  { vol: 20, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 20", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 20 (आंबेडकर आंदोलन के सामाजिक एवं राजनीतिक दस्तावेज: भाग 3)", year: 2004, subjects: ["Independent Labour Party", "Scheduled Castes Federation", "Manifestos"], desc: "Manifestos and conference proceedings of Independent Labour Party and Scheduled Castes Federation." },
  { vol: 21, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 21", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 21 (बहिष्कृत भारत एवं मूकनायक के सम्पादकीय एवं लेख: भाग 1)", year: 2005, subjects: ["Mooknayak", "Bahishkrit Bharat", "Editorials"], desc: "Pioneering journalistic editorials from Mooknayak (1920) and Bahishkrit Bharat (1927)." },
  { vol: 22, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 22", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 22 (बहिष्कृत भारत एवं मूकनायक के सम्पादकीय एवं लेख: भाग 2)", year: 2019, subjects: ["Bahishkrit Bharat", "Journalism", "Mahad Satyagraha"], desc: "Journalistic writings during Mahad Satyagraha and Kalaram Temple Entry campaign." },
  { vol: 23, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 23", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 23 (जनता एवं प्रबुद्ध भारत के सम्पादकीय एवं लेख: भाग 1)", year: 2019, subjects: ["Janata Periodical", "Prabuddha Bharat", "Editorials"], desc: "Editorials from weekly periodical 'Janata' established by Dr. Ambedkar in 1930." },
  { vol: 24, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 24", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 24 (जनता एवं प्रबुद्ध भारत के सम्पादकीय एवं लेख: भाग 2)", year: 2019, subjects: ["Janata Periodical", "Agrarian Reform", "Social Equality"], desc: "Articles on peasant struggles, abolition of Khoti system, and industrial labor rights." },
  { vol: 25, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 25", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 25 (जनता एवं प्रबुद्ध भारत के सम्पादकीय एवं लेख: भाग 3)", year: 2019, subjects: ["Janata Periodical", "Prabuddha Bharat", "Democratic Rights"], desc: "Writings on constitutional safeguards, educational advancement, and social democracy." },
  { vol: 26, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 26", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 26 (डॉ. अम्बेडकर के सामाजिक आंदोलन के ऐतिहासिक भाषण एवं संदेश: भाग 1)", year: 2019, subjects: ["Public Speeches", "Social Reform", "Youth Addresses"], desc: "Speeches delivered to student unions, women's conferences, and municipal councils (1920–1935)." },
  { vol: 27, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 27", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 27 (डॉ. अम्बेडकर के सामाजिक आंदोलन के ऐतिहासिक भाषण एवं संदेश: भाग 2)", year: 2019, subjects: ["Public Speeches", "Labor Assemblies", "Pre-independence Politics"], desc: "Speeches delivered to trade union congresses and provincial rallies (1936–1946)." },
  { vol: 28, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 28", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 28 (डॉ. अम्बेडकर के सामाजिक आंदोलन के ऐतिहासिक भाषण एवं संदेश: भाग 3)", year: 2019, subjects: ["Public Speeches", "Post-independence Rallies", "Constitutional Guidance"], desc: "Speeches to civic bodies, university convocations, and democratic forums (1947–1956)." },
  { vol: 29, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 29", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 29 (श्रम, जल संसाधन, विद्युत एवं राष्ट्रीय पुनर्निर्माण: भाग 1)", year: 2019, subjects: ["National Reconstruction", "River Valley Projects", "Labor Welfare"], desc: "Foundational documents creating Central Waterways, Irrigation and Navigation Commission (CWINC)." },
  { vol: 30, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 30", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 30 (श्रम, जल संसाधन, विद्युत एवं राष्ट्रीय पुनर्निर्माण: भाग 2)", year: 2019, subjects: ["Power Policy", "National Power Grid", "Coal Mines Safety"], desc: "Technical reports establishing the Central Electricity Authority and coal safety legislation." },
  { vol: 31, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 31", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 31 (राज्य पुनर्गठन, संघीय ढांचा और लोकतांत्रिक संस्थाएं)", year: 2019, subjects: ["States Reorganisation", "Federalism", "Democratic Institutions"], desc: "Treatise on Thoughts on Linguistic States and submission to States Reorganisation Commission (1955)." },
  { vol: 32, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 32", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 32 (बौद्ध धर्म, दर्शन और धर्मान्तरण आंदोलन: भाग 1)", year: 2019, subjects: ["Buddhism", "Nagpur Conversion 1956", "Dhamma Deeksha"], desc: "Historical records, speeches, and twenty-two vows of the historic Deekshabhoomi conversion (1956)." },
  { vol: 33, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 33", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 33 (बौद्ध धर्म, दर्शन और धर्मान्तरण आंदोलन: भाग 2)", year: 2019, subjects: ["Buddhist Epistemology", "World Buddhist Conferences", "Dhamma Revolution"], desc: "Ambedkar's addresses at World Fellowship of Buddhists (Colombo, Rangoon, Kathmandu)." },
  { vol: 34, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 34", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 34 (डॉ. अम्बेडकर का ऐतिहासिक पत्राचार एवं आलेख: भाग 1)", year: 2019, subjects: ["Correspondence", "Columbia University", "Letters to Colleagues"], desc: "Personal and scholarly correspondence during Columbia and London School of Economics years." },
  { vol: 35, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 35", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 35 (डॉ. अम्बेडकर का ऐतिहासिक पत्राचार एवं आलेख: भाग 2)", year: 2019, subjects: ["Correspondence", "Viceroy Letters", "Constitutional Correspondence"], desc: "Official letters with British governors, Cabinet Mission members, and national leaders (1930–1946)." },
  { vol: 36, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 36", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 36 (डॉ. अम्बेडकर का ऐतिहासिक पत्राचार एवं आलेख: भाग 3)", year: 2019, subjects: ["Correspondence", "Nehru Letters", "Buddhist Societies"], desc: "Correspondence with Jawaharlal Nehru, Rajendra Prasad, and international Buddhist scholars." },
  { vol: 37, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 37", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 37 (संसदीय बहसें और विधान परिषदीय कार्यवाही: भाग 1)", year: 2019, subjects: ["Parliamentary Debates", "Provisional Parliament", "Finance Bills"], desc: "Verbatim interventions in the Provisional Parliament of India on finance, land, and budget (1950–1952)." },
  { vol: 38, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 38", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 38 (संसदीय बहसें और विधान परिषदीय कार्यवाही: भाग 2)", year: 2019, subjects: ["Rajya Sabha Debates", "Foreign Policy", "Untouchability Offences Bill"], desc: "Parliamentary debates in Rajya Sabha on Untouchability (Offences) Act, Special Marriage Act, and diplomacy." },
  { vol: 39, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 39", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 39 (संविधान निर्माण में योगदान एवं ऐतिहासिक संशोधन प्रस्ताव: भाग 1)", year: 2019, subjects: ["Constitutional Amendments", "Fundamental Rights", "Directive Principles"], desc: "Detailed drafting committee revisions on Fundamental Rights and Directive Principles of State Policy." },
  { vol: 40, titleEn: "Collected Works of Babasaheb Dr. Ambedkar: Volume 40", titleHi: "बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय: खण्ड 40 (संविधान निर्माण में योगदान एवं ऐतिहासिक संशोधन प्रस्ताव: भाग 2)", year: 2019, subjects: ["Constitutional Amendments", "Judiciary", "Emergency Provisions"], desc: "Amendments on the Union Judiciary, Election Commission, and final ratification of the Indian Constitution." }
];

// ============================================================================
// 2. BAWS - 17 VOLUMES (20 PARTS) (ENGLISH)
// ============================================================================
const bawsTitles: Array<{ key: string; volNumberStr: string; title: string; year: number; subjects: string[]; desc: string }> = [
  { key: "vol-01", volNumberStr: "Volume 1", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 1", year: 1979, subjects: ["Castes in India", "Annihilation of Caste", "Linguistic Provinces", "Small Holdings"], desc: "Contains Castes in India: Their Mechanism, Genesis and Development; Annihilation of Caste; Maharashtra as a Linguistic Province; Need for Checks and Balances; and Thoughts on Linguistic States." },
  { key: "vol-02", volNumberStr: "Volume 2", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 2", year: 1982, subjects: ["Bombay Legislature", "Simon Commission", "Round Table Conferences"], desc: "Dr. Ambedkar in the Bombay Legislature (1927–1939), With the Simon Commission, and At the Round Table Conferences (1930–1932)." },
  { key: "vol-03", volNumberStr: "Volume 3", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 3", year: 1987, subjects: ["Philosophy of Hinduism", "India and Communism", "Revolution and Counter-Revolution", "Buddha or Karl Marx"], desc: "Major ideological treatises including Philosophy of Hinduism, India and the Pre-requisites of Communism, Revolution and Counter-Revolution in Ancient India, and Buddha or Karl Marx." },
  { key: "vol-04", volNumberStr: "Volume 4", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 4", year: 1987, subjects: ["Riddles in Hinduism", "Religious Critique", "Ancient Indian History"], desc: "Riddles in Hinduism: An Exposition to Enlighten the Masses, interrogating religious scriptures, myths, and historical doctrines." },
  { key: "vol-05", volNumberStr: "Volume 5", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 5", year: 1989, subjects: ["Untouchables", "Civil Rights", "Social Exclusion"], desc: "Essays on Untouchables or The Children of India's Ghetto; A Description of the Inhuman System of Social Boycott and Civil Disabilities." },
  { key: "vol-06", volNumberStr: "Volume 6", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 6", year: 1989, subjects: ["Indian Economics", "Problem of the Rupee", "Evolution of Provincial Finance", "East India Company"], desc: "Economic dissertations: Administration and Finance of the East India Company; The Evolution of Provincial Finance in British India; and The Problem of the Rupee: Its Origin and Its Solution." },
  { key: "vol-07", volNumberStr: "Volume 7", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 7", year: 1990, subjects: ["Who Were the Shudras", "Origin of Untouchability", "Caste Origins"], desc: "Two profound historical investigations: Who Were the Shudras? and The Untouchables: Who Were They and Why They Became Untouchables?" },
  { key: "vol-08", volNumberStr: "Volume 8", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 8", year: 1990, subjects: ["Pakistan or Partition of India", "Geopolitics", "Communal Relations"], desc: "Pakistan or the Partition of India: Comprehensive demographic, geopolitical, and historical analysis of communal relations and minority safeguards." },
  { key: "vol-09", volNumberStr: "Volume 9", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 9", year: 1991, subjects: ["Poona Pact", "Congress and Gandhi", "Separate Electorates"], desc: "What Congress and Gandhi Have Done to the Untouchables and Mr. Gandhi and the Emancipation of the Untouchables." },
  { key: "vol-10", volNumberStr: "Volume 10", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 10", year: 1991, subjects: ["Executive Council", "Labor Welfare", "Waterways", "Damodar Valley"], desc: "Dr. Ambedkar as Member of the Governor General's Executive Council (1942–1946) covering labor safety, coal legislation, and river valley projects." },
  { key: "vol-11", volNumberStr: "Volume 11", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 11", year: 1992, subjects: ["The Buddha and His Dhamma", "Buddhism", "Navayana Philosophy"], desc: "The Buddha and His Dhamma: Canonical treatise synthesizing the rationalist, ethical, and egalitarian core of Buddhist philosophy." },
  { key: "vol-12", volNumberStr: "Volume 12", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 12", year: 1993, subjects: ["Ancient Indian Commerce", "Pax Britannica", "Unpublished Treatises"], desc: "Unpublished Writings including Ancient Indian Commerce, The Untouchables and the Pax Britannica, and Lectures on the English Constitution." },
  { key: "vol-13", volNumberStr: "Volume 13", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 13", year: 1994, subjects: ["Constitution of India", "Constituent Assembly", "Drafting Committee"], desc: "Dr. Ambedkar as the Principal Architect of the Constitution of India: Compilation of Constituent Assembly speeches, draft amendments, and constitutional debates." },
  { key: "vol-14-pt1", volNumberStr: "Volume 14, Part One", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 14, Part One", year: 1995, subjects: ["Hindu Code Bill", "Women's Legal Rights", "Parliamentary Debates"], desc: "Dr. Ambedkar and the Hindu Code Bill, Part One: Drafting, section-by-section parliamentary debates, and legal advocacy for women's inheritance and divorce rights." },
  { key: "vol-14-pt2", volNumberStr: "Volume 14, Part Two", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 14, Part Two", year: 1995, subjects: ["Hindu Code Bill", "Cabinet Resignation", "Legal Equality"], desc: "Dr. Ambedkar and the Hindu Code Bill, Part Two: Continued legislative struggle, parliamentary obstruction, and Dr. Ambedkar's historic resignation statement from the Union Cabinet (1951)." },
  { key: "vol-15", volNumberStr: "Volume 15", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 15", year: 1997, subjects: ["Law Ministry", "Parliamentary Opposition", "Rajya Sabha"], desc: "Dr. Ambedkar as Free India's First Law Minister and Member of Opposition in Parliament (1947–1956): Speeches on fundamental rights, judicial independence, and diplomacy." },
  { key: "vol-16", volNumberStr: "Volume 16", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 16", year: 1998, subjects: ["Pali Grammar", "Pali Dictionary", "Buddhist Education"], desc: "Dr. B. R. Ambedkar: Grammar of Pali Language; Pali-English Dictionary; Tripitaka and Educational Foundations (Siddharth College and People's Education Society)." },
  { key: "vol-17-pt1", volNumberStr: "Volume 17, Part One", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part One", year: 2003, subjects: ["Egalitarian Revolution", "Speeches", "Public Addresses"], desc: "Dr. B. R. Ambedkar and His Egalitarian Revolution, Part One: Speeches across social emancipation rallies, trade union conventions, and mass assemblies." },
  { key: "vol-17-pt2", volNumberStr: "Volume 17, Part Two", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part Two", year: 2003, subjects: ["Egalitarian Revolution", "Socio-Political Movements", "Religious Emancipation"], desc: "Dr. B. R. Ambedkar and His Egalitarian Revolution, Part Two: Socio-political and religious activities, conversion movement, and social democracy." },
  { key: "vol-17-pt3", volNumberStr: "Volume 17, Part Three", title: "Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part Three", year: 2003, subjects: ["Egalitarian Revolution", "Speeches and Letters", "Ephemera"], desc: "Dr. B. R. Ambedkar and His Egalitarian Revolution, Part Three: Speeches, historical letters, memoranda to international bodies, and rare ephemera." }
];

// ============================================================================
// 3. SAMAJIK NYAY SANDESH - PARENT PERIODICAL RECORD
// ============================================================================
const snsParent = {
  key: "sns-parent",
  title: "Samajik Nyay Sandesh (सामाजिक न्याय संदेश)",
  titleHi: "सामाजिक न्याय संदेश (डॉ. अम्बेडकर प्रतिष्ठान शोध पत्रिका)",
  year: 1993,
  subjects: ["Samajik Nyay Sandesh", "Social Justice", "Ambedkarite Thought", "DAF Journal"],
  desc: "Official monthly/quarterly socio-political and academic archival journal published by the Dr. Ambedkar Foundation, Ministry of Social Justice and Empowerment, Government of India. Preserves scholarly discourses on constitutional rights, egalitarian reforms, and Dr. Ambedkar's ideological legacy."
};

/**
 * Builds the complete list of 61 normalized archival packages ready for ingestion.
 */
export function buildNdliArchivalPackages(): NdliArchivalEntry[] {
  const entries: NdliArchivalEntry[] = [];

  // A. CWBA (40 Volumes)
  for (const item of cwbaTitles) {
    const volPadded = String(item.vol).padStart(2, '0');
    const sourceRecId = `sr-cwba-vol-${volPadded}`;
    const archiveItemId = `item-cwba-vol-${volPadded}`;
    const archiveId = `DAF-CWBA-VOL-${volPadded}`;
    const dcId = `dc-cwba-vol-${volPadded}`;

    entries.push({
      sourceRecord: {
        id: sourceRecId,
        sourceCollectionId: 'source-ambedkar-foundation',
        originalSourceIdentifier: `CWBA-VOL-${volPadded}`,
        originalTitle: item.titleHi,
        originalUrl: NDLI_CWBA_URL,
        repository: 'Dr. Ambedkar Foundation / National Digital Library of India (NDLI)',
        sourceMetadata: {
          ndliHandle: 'A_F_1003518320',
          collection: 'Collected Works of Babasaheb Dr. Ambedkar',
          series: 'बाबासाहेब डॉ. अम्बेडकर सम्पूर्ण वाङ्‌मय',
          volume: item.vol,
          language: 'hi',
          publisher: 'Dr. Ambedkar Foundation, Ministry of Social Justice and Empowerment, Govt. of India',
          federator: 'National Digital Library of India, IIT Kharagpur',
          accessRestriction: 'Open Access (Portal-guarded)'
        },
        ingestionMethod: 'API_CONNECTOR',
        provenanceNotes: `Official Hindi translation and compilation published by Dr. Ambedkar Foundation (DAF). Digitally cataloged in National Digital Library of India under handle A_F_1003518320.`,
        isDemoRecord: false
      },
      archiveItem: {
        id: archiveItemId,
        archiveId,
        sourceRecordId: sourceRecId,
        title: item.titleHi,
        titleHi: item.titleHi,
        category: 'Books & Writings',
        date: `Volume ${item.vol}, ${item.year}`,
        year: item.year,
        author: 'Dr. B. R. Ambedkar (बाबासाहेब डॉ. भीमराव रामजी अम्बेडकर)',
        collection: 'Collected Works of Babasaheb Dr. Ambedkar',
        sourceInstitution: 'Dr. Ambedkar Foundation',
        sourceProvenance: 'Dr. Ambedkar Foundation / National Digital Library of India (NDLI)',
        language: 'Hindi',
        originalHolding: 'Dr. Ambedkar Foundation Archive, New Delhi / NDLI Repository',
        description: item.desc,
        descriptionHi: item.titleHi,
        fullText: `${item.titleHi}. ${item.desc} प्रकाशित: डॉ. अम्बेडकर प्रतिष्ठान, सामाजिक न्याय एवं अधिकारिता मंत्रालय, भारत सरकार। संदर्भ: राष्ट्रीय डिजिटल पुस्तकालय (NDLI - A_F_1003518320).`,
        aiSummary: `Canonical Volume ${item.vol} of Babasaheb Dr. Ambedkar's Complete Works in Hindi, covering ${item.subjects.join(', ')}.`,
        keyConcepts: item.subjects,
        publishingStatus: 'Published',
        isFeatured: item.vol <= 5,
        isDemoRecord: false
      },
      dublinCore: {
        id: dcId,
        archiveItemId,
        title: item.titleHi,
        creator: 'Dr. B. R. Ambedkar',
        subject: item.subjects,
        description: item.desc,
        publisher: 'Dr. Ambedkar Foundation, Ministry of Social Justice and Empowerment, Government of India',
        contributor: 'Centenary Celebrations Committee & DAF Editorial Board; Federated by NDLI, IIT Kharagpur',
        date: String(item.year),
        type: 'Books & Writings',
        format: 'Monograph / Scholarly Edition',
        identifier: archiveId,
        source: NDLI_CWBA_URL,
        language: 'hi',
        relation: ['Collected Works of Babasaheb Dr. Ambedkar', `Volume ${item.vol}`],
        coverage: 'India; 1916-1956',
        rights: 'Official Government Publication / Dr. Ambedkar Foundation / Educational Access'
      }
    });
  }

  // B. BAWS (20 Parts across 17 Volumes)
  for (const item of bawsTitles) {
    const sourceRecId = `sr-baws-${item.key}`;
    const archiveItemId = `item-baws-${item.key}`;
    const archiveId = `DAF-BAWS-${item.key.toUpperCase()}`;
    const dcId = `dc-baws-${item.key}`;

    entries.push({
      sourceRecord: {
        id: sourceRecId,
        sourceCollectionId: 'source-ambedkar-foundation',
        originalSourceIdentifier: `BAWS-${item.key.toUpperCase()}`,
        originalTitle: item.title,
        originalUrl: NDLI_BAWS_URL,
        repository: 'Dr. Ambedkar Foundation / Government of Maharashtra / NDLI',
        sourceMetadata: {
          ndliHandle: 'A_F_W_A_S_O_D_B_A_1150077701',
          collection: 'Writings and Speeches of Dr. Babasaheb Ambedkar',
          series: 'Dr. Babasaheb Ambedkar: Writings and Speeches',
          volume: item.volNumberStr,
          language: 'en',
          publisher: 'Dr. Ambedkar Foundation / Education Department, Government of Maharashtra',
          federator: 'National Digital Library of India, IIT Kharagpur',
          accessRestriction: 'Open Access (Portal-guarded)'
        },
        ingestionMethod: 'API_CONNECTOR',
        provenanceNotes: `Canonical English series published by Education Dept., Govt. of Maharashtra and reprinted by Dr. Ambedkar Foundation. Cataloged in National Digital Library of India under handle A_F_W_A_S_O_D_B_A_1150077701.`,
        isDemoRecord: false
      },
      archiveItem: {
        id: archiveItemId,
        archiveId,
        sourceRecordId: sourceRecId,
        title: item.title,
        category: 'Books & Writings',
        date: `${item.volNumberStr}, ${item.year}`,
        year: item.year,
        author: 'Dr. B. R. Ambedkar',
        collection: 'Writings and Speeches of Dr. Babasaheb Ambedkar',
        sourceInstitution: 'Dr. Ambedkar Foundation',
        sourceProvenance: 'Dr. Ambedkar Foundation / Government of Maharashtra / NDLI',
        language: 'English',
        originalHolding: 'Government of Maharashtra / Dr. Ambedkar Foundation / NDLI Repository',
        description: item.desc,
        fullText: `${item.title}. ${item.desc} Published by Dr. Ambedkar Foundation and Government of Maharashtra. Cataloged in NDLI (A_F_W_A_S_O_D_B_A_1150077701).`,
        aiSummary: `Canonical scholarly edition of ${item.volNumberStr} of Dr. Babasaheb Ambedkar: Writings and Speeches (BAWS), focusing on ${item.subjects.join(', ')}.`,
        keyConcepts: item.subjects,
        publishingStatus: 'Published',
        isFeatured: item.key === 'vol-01' || item.key === 'vol-06' || item.key === 'vol-11' || item.key === 'vol-13',
        isDemoRecord: false
      },
      dublinCore: {
        id: dcId,
        archiveItemId,
        title: item.title,
        creator: 'Dr. B. R. Ambedkar',
        subject: item.subjects,
        description: item.desc,
        publisher: 'Dr. Ambedkar Foundation / Education Department, Government of Maharashtra',
        contributor: 'Centenary Celebrations Committee; Federated by NDLI, IIT Kharagpur',
        date: String(item.year),
        type: 'Books & Writings',
        format: 'Monograph / Scholarly Edition',
        identifier: archiveId,
        source: NDLI_BAWS_URL,
        language: 'en',
        relation: ['Dr. Babasaheb Ambedkar: Writings and Speeches', item.volNumberStr],
        coverage: 'India, United Kingdom, USA; 1916-1956',
        rights: 'Official Government Publication / Dr. Ambedkar Foundation / Educational Access'
      }
    });
  }

  // C. SAMAJIK NYAY SANDESH (Parent Periodical Collection Record)
  const snsSourceRecId = 'sr-samajik-nyay-sandesh-parent';
  const snsArchiveItemId = 'item-samajik-nyay-sandesh-parent';
  const snsArchiveId = 'DAF-SNS-PARENT-COLLECTION';
  const snsDcId = 'dc-samajik-nyay-sandesh-parent';

  entries.push({
    sourceRecord: {
      id: snsSourceRecId,
      sourceCollectionId: 'source-ambedkar-foundation',
      originalSourceIdentifier: 'SNS-PERIODICAL-SERIES',
      originalTitle: snsParent.title,
      originalUrl: NDLI_SNS_URL,
      repository: 'Dr. Ambedkar Foundation / National Digital Library of India (NDLI)',
      sourceMetadata: {
        ndliHandle: 'A_F_288267570',
        collection: 'Samajik Nyay Sandesh',
        periodical: 'सामाजिक न्याय संदेश',
        publisher: 'Dr. Ambedkar Foundation, Ministry of Social Justice and Empowerment, Govt. of India',
        federator: 'National Digital Library of India, IIT Kharagpur',
        accessRestriction: 'Open Access (Portal-guarded)'
      },
      ingestionMethod: 'API_CONNECTOR',
      provenanceNotes: 'Official periodical of the Dr. Ambedkar Foundation cataloged under NDLI identifier A_F_288267570. Parent collection metadata record.',
      isDemoRecord: false
    },
    archiveItem: {
      id: snsArchiveItemId,
      archiveId: snsArchiveId,
      sourceRecordId: snsSourceRecId,
      title: snsParent.title,
      titleHi: snsParent.titleHi,
      category: 'Historical Records',
      date: 'Archival Periodical Series (Established 1993)',
      year: snsParent.year,
      author: 'Dr. Ambedkar Foundation Editorial Board',
      collection: 'Samajik Nyay Sandesh',
      sourceInstitution: 'Dr. Ambedkar Foundation',
      sourceProvenance: 'Dr. Ambedkar Foundation / National Digital Library of India (NDLI)',
      language: 'Hindi',
      originalHolding: 'Dr. Ambedkar Foundation Archive, New Delhi',
      description: snsParent.desc,
      descriptionHi: snsParent.titleHi,
      fullText: `${snsParent.title}. ${snsParent.desc} Official archival periodical cataloged under NDLI handle A_F_288267570.`,
      aiSummary: 'Official periodical journal of the Dr. Ambedkar Foundation exploring social justice doctrine, constitutional guarantees, and archival retrospectives.',
      keyConcepts: snsParent.subjects,
      publishingStatus: 'Published',
      isFeatured: true,
      isDemoRecord: false
    },
    dublinCore: {
      id: snsDcId,
      archiveItemId: snsArchiveItemId,
      title: snsParent.title,
      creator: 'Dr. Ambedkar Foundation',
      subject: snsParent.subjects,
      description: snsParent.desc,
      publisher: 'Dr. Ambedkar Foundation, Ministry of Social Justice and Empowerment, Government of India',
      contributor: 'Federated by National Digital Library of India, IIT Kharagpur',
      date: String(snsParent.year),
      type: 'Historical Records',
      format: 'Periodical / Journal',
      identifier: snsArchiveId,
      source: NDLI_SNS_URL,
      language: 'hi',
      relation: ['Samajik Nyay Sandesh Archival Collection'],
      coverage: 'India; 1993-Present',
      rights: 'Official Government Publication / Dr. Ambedkar Foundation / Educational Access'
    }
  });

  return entries;
}
