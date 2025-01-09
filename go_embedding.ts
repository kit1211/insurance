import * as fs from 'fs';
import * as path from 'path';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// ตั้งค่า API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT || '';
const INDEX_NAME = 'discorddemo'; // ชื่อ Index ใน Pinecone
const NAMESPACE = 'shoe'; // Namespace ที่ใช้ใน Pinecone

// ตรวจสอบว่า API Keys ถูกตั้งค่าหรือยัง
if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_ENVIRONMENT) {
    console.error('กรุณาตั้งค่า OPENAI_API_KEY, PINECONE_API_KEY, และ PINECONE_ENVIRONMENT');
    process.exit(1);
}

// ตั้งค่า Pinecone Client
const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
});


// ตั้งค่า OpenAI API
const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
});



function sanitizeVectorId(fileName: string): string {
    // แทนที่ช่องว่างด้วย "_", ลบอักขระ Unicode
    return fileName
        .normalize('NFKD') // Normalize เพื่อแยกส่วนประกอบของ Unicode
        .replace(/[\u0300-\u036f]/g, '') // ลบ diacritic marks (หากมี)
        .replace(/[^\x00-\x7F]/g, '') // ลบอักขระที่ไม่ใช่ ASCII
        .replace(/\s+/g, '_'); // แทนที่ช่องว่างด้วย "_"
}

function encodeVectorId(fileName: string): string {
    return Buffer.from(fileName).toString('base64'); // แปลงชื่อไฟล์เป็น Base64
}

// ฟังก์ชันแบ่งข้อความเป็น chunks
function chunkText(text: string, chunkSize: number, maxChunks: number): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        if (chunks.length >= maxChunks) break; // หยุดเมื่อถึงจำนวน chunks สูงสุด
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

// ฟังก์ชันสำหรับสร้าง Embedding
async function generateEmbedding(text: string): Promise<number[]> {
    const response = await client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
    });

    return response.data[0].embedding;
}



// ฟังก์ชันสำหรับอัปโหลดข้อมูลเข้า Pinecone
async function uploadToPinecone(indexName: string, namespace: string, id: string, embedding: number[], metadata: any) {
    const index = pinecone.Index(indexName);
    await index.namespace(namespace).upsert([
        {
            id: id,
            values: embedding,
            metadata: metadata
        }
    ]);

    console.log(`อัปโหลดไฟล์ ${id} เข้า Pinecone สำเร็จ`);
}

// ฟังก์ชันสำหรับอ่านไฟล์และสร้าง Embedding
async function processFilesInFolder(folderPath: string) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        if (fs.statSync(fullPath).isFile() && path.extname(file).toLowerCase() === '.txt') {
            console.log(`กำลังประมวลผลไฟล์: ${file}`);

            try {
                // อ่านไฟล์
                const text = fs.readFileSync(fullPath, 'utf-8');

                // แบ่งข้อความเป็น chunks
                const chunks = chunkText(text, 7500, 100);

                // ประมวลผลแต่ละ chunk
                for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                    const chunk = chunks[chunkIndex];

                    // สร้าง Embedding
                    const embedding = await generateEmbedding(chunk);

                    // สร้าง ID ที่ไม่ซ้ำสำหรับแต่ละ chunk
                    const id = `${sanitizeVectorId(file)}_chunk_${chunkIndex}`;

                    // อัปโหลดเข้า Pinecone
                    const metadata = { filename: file, chunkIndex }; // เพิ่ม metadata ได้ตามต้องการ
                    await uploadToPinecone(INDEX_NAME, NAMESPACE, id, embedding, metadata);

                    console.log(`อัปโหลด chunk ${chunkIndex + 1}/${chunks.length} สำหรับไฟล์ ${file}`);
                }
            } catch (error: any) {
                console.error(`เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${file}`);
                console.error(error.message);
            }
        }
    }
}

// ฟังก์ชันหลัก
(async () => {
    const folderPath = './output'; // โฟลเดอร์ที่เก็บไฟล์

    if (!fs.existsSync(folderPath)) {
        console.error(`ไม่พบโฟลเดอร์: ${folderPath}`);
        process.exit(1);
    }

    console.log('เริ่มประมวลผลไฟล์...');
    await processFilesInFolder(folderPath);
    console.log('ประมวลผลไฟล์เสร็จสิ้น');
})();
