import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { extractCvData } from '@/ai/flows/extract-cv-data';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'cvs');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeEmail = session.user.email.replace(/[^a-z0-9]/gi, '_');
    const fileExt = file.name.split('.').pop();
    const filename = `${safeEmail}_${timestamp}.${fileExt}`;
    const filepath = join(uploadsDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Extract text from file based on type
    let cvContent = '';
    try {
      if (file.type === 'application/pdf') {
        const pdfBuffer = await readFile(filepath);
        const pdfData = await pdfParse(pdfBuffer);
        cvContent = pdfData.text;
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX
        const result = await mammoth.extractRawText({ path: filepath });
        cvContent = result.value;
      } else if (file.type === 'application/msword') {
        // DOC - mammoth can handle both DOC and DOCX
        const result = await mammoth.extractRawText({ path: filepath });
        cvContent = result.value;
      }
    } catch (extractError) {
      console.error('Error extracting text from CV:', extractError);
      return NextResponse.json(
        { error: 'Failed to extract text from CV file' },
        { status: 500 }
      );
    }

    // Parse CV content with AI
    let parsedData;
    try {
      parsedData = await extractCvData({
        cvContent,
        cvFileName: file.name
      });
    } catch (aiError) {
      console.error('Error parsing CV with AI:', aiError);
      // Return empty parsed data if AI parsing fails
      parsedData = {
        skills: [],
        achievements: [],
        awards: [],
        workExperience: [],
        personalStatement: '',
        education: ''
      };
    }

    return NextResponse.json({
      filePath: filepath,
      parsedData
    }, { status: 200 });

  } catch (error) {
    console.error('Error uploading CV:', error);
    return NextResponse.json(
      { error: 'Failed to upload CV' },
      { status: 500 }
    );
  }
}
