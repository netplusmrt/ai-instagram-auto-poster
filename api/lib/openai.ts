import OpenAI from 'openai';
import { required } from './env';

export const openai = new OpenAI({
  apiKey: required('OPENAI_API_KEY')
});