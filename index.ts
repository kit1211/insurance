import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';





// ฟังก์ชันค้นหาไฟล์ PDF ในโฟลเดอร์และโฟลเดอร์ย่อย
function getPDFFilesFromFolder(folderPath: string): string[] {
    let pdfFiles: string[] = [];
    const files = fs.readdirSync(folderPath);
    files.forEach(file => {
        const fullPath = path.join(folderPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            // หากเป็นโฟลเดอร์ ค้นหาในโฟลเดอร์ย่อย
            pdfFiles = pdfFiles.concat(getPDFFilesFromFolder(fullPath));
        } else if (path.extname(file).toLowerCase() === '.pdf') {
            // หากเป็นไฟล์ PDF
            pdfFiles.push(fullPath);
        }
    });

    return pdfFiles;
}




// ฟังก์ชันทำความสะอาดข้อความ
function cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // ลบช่องว่างที่เกิน
      .replace(/\n\s*\n/g, '\n') // ลบบรรทัดว่าง
      .replace(/[^\u0000-\u007F\u0E00-\u0E7F\u4E00-\u9FFF\uAC00-\uD7A3\s.,:;()/\-]+/g, '') // ลบอักขระที่ไม่ใช่ UTF-8
      .trim(); // ตัดช่องว่างที่หัวและท้าย
}


// ฟังก์ชันแปลง PDF เป็นข้อความ
async function extractTextFromPDF(pdfPath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return cleanText(data.text); // ทำความสะอาดข้อความก่อนคืนค่า
}

// ฟังก์ชันประมวลผล PDF ทั้งหมดในโฟลเดอร์
async function processPDFFiles(folderPath: string, outputFolderPath: string): Promise<void> {
    const pdfFiles = getPDFFilesFromFolder(folderPath);

    if (pdfFiles.length === 0) {
        console.log(`ไม่มีไฟล์ PDF ในโฟลเดอร์: ${folderPath}`);
        return;
    }

    console.log(`พบไฟล์ PDF ทั้งหมด ${pdfFiles.length} ไฟล์`);

    for (const pdfFile of pdfFiles) {
        console.log(`กำลังประมวลผล: ${pdfFile}`);

        try {
            // ดึงข้อความจาก PDF
            const text = await extractTextFromPDF(pdfFile);

            // สร้างไฟล์ผลลัพธ์
            const outputFileName = path.basename(pdfFile, '.pdf') + '_output.txt';
            const outputPath = path.join(outputFolderPath, outputFileName.replace(/\s+/g, '_'));

            // บันทึกข้อความในไฟล์
            fs.writeFileSync(outputPath, text, 'utf-8');
            console.log(`ข้อความถูกบันทึกที่: ${outputPath}`);
        } catch (error: any) {
            console.error(`เกิดข้อผิดพลาดกับไฟล์: ${pdfFile}`);
            console.error(`รายละเอียด: ${error.message}`);
        }
    }
}

// ฟังก์ชันหลัก
(async () => {
    const inputFolderPath = './source'; // โฟลเดอร์ที่เก็บ PDF
    const outputFolderPath = './output'; // โฟลเดอร์สำหรับบันทึกผลลัพธ์

    // ตรวจสอบว่ามีโฟลเดอร์ผลลัพธ์หรือไม่ ถ้าไม่มีให้สร้าง
    if (!fs.existsSync(outputFolderPath)) {
        fs.mkdirSync(outputFolderPath, { recursive: true });
    }

    // เรียกใช้งานการประมวลผล
    await processPDFFiles(inputFolderPath, outputFolderPath);

    console.log('ประมวลผลไฟล์ PDF เสร็จสิ้น');
})();
