import re

def extract_modal_content(filepath, modal_id_pattern):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return str(e)
    
    form_pattern = re.search(r'<div[^>]*id=\"[' + modal_id_pattern + r'].*?(<form.*?</form>)', content, re.DOTALL | re.IGNORECASE)
    if form_pattern:
        text = form_pattern.group(1)
        if len(text) > 2000:
            return text[:1000] + '\n... [TRUNCATED] ...\n' + text[-1000:]
        return text
    
    return 'Form not found using regex'

print('--- Rtfrn.html (Update) ---')
print(extract_modal_content(r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\Rtfrn.html', 'update'))

print('\n--- Rtcrl.html (View) ---')
print(extract_modal_content(r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\Rtcrl.html', 'view'))
