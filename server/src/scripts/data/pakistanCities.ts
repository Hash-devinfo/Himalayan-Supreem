// Starting list of Pakistani cities and towns for the checkout dropdown.
// Covers every district headquarters plus the main towns in each region.
// A city NOT listed here can still be typed at checkout (it is saved and flagged for review),
// and the admin can add or block any city later.
import type { Province } from '../../constants/enums.js';

// Major cities first in the dropdown (lower number = higher up). Everything else: 100.
export const MAJOR_CITIES: Record<string, number> = {
  Karachi: 1,
  Lahore: 2,
  Islamabad: 3,
  Rawalpindi: 4,
  Faisalabad: 5,
  Multan: 6,
  Peshawar: 7,
  Quetta: 8,
  Hyderabad: 9,
  Gujranwala: 10,
  Sialkot: 11,
};

export const PAKISTAN_CITIES: Record<Province, string[]> = {
  Punjab: [
    // Lahore and Sheikhupura region
    'Lahore', 'Raiwind', 'Sheikhupura', 'Muridke', 'Ferozewala', 'Sharaqpur', 'Safdarabad', 'Nankana Sahib',
    'Shahkot', 'Sangla Hill', 'Kasur', 'Pattoki', 'Chunian', 'Kot Radha Kishan', 'Okara', 'Renala Khurd',
    'Depalpur', 'Haveli Lakha',
    // Rawalpindi region
    'Rawalpindi', 'Murree', 'Gujar Khan', 'Kahuta', 'Kotli Sattian', 'Kallar Syedan', 'Taxila', 'Wah Cantonment',
    'Attock', 'Hasan Abdal', 'Fateh Jang', 'Pindi Gheb', 'Jhelum', 'Dina', 'Pind Dadan Khan', 'Sohawa',
    'Chakwal', 'Choa Saidan Shah', 'Talagang',
    // Gujranwala region
    'Gujranwala', 'Kamoke', 'Wazirabad', 'Nowshera Virkan', 'Ali Pur Chatha', 'Gujrat', 'Kharian', 'Lalamusa',
    'Sarai Alamgir', 'Jalalpur Jattan', 'Mandi Bahauddin', 'Phalia', 'Malakwal', 'Hafizabad', 'Pindi Bhattian',
    'Sialkot', 'Daska', 'Sambrial', 'Pasrur', 'Narowal', 'Shakargarh', 'Zafarwal',
    // Faisalabad region
    'Faisalabad', 'Jaranwala', 'Samundri', 'Tandlianwala', 'Chak Jhumra', 'Toba Tek Singh', 'Gojra', 'Kamalia',
    'Pir Mahal', 'Jhang', 'Shorkot', 'Ahmedpur Sial', 'Chiniot',
    // Sargodha region
    'Sargodha', 'Bhalwal', 'Kot Momin', 'Sillanwali', 'Shahpur', 'Khushab', 'Noorpur Thal', 'Quaidabad',
    'Mianwali', 'Isa Khel', 'Piplan', 'Kalabagh', 'Bhakkar', 'Darya Khan', 'Kallur Kot', 'Mankera',
    // Sahiwal region
    'Sahiwal', 'Chichawatni', 'Pakpattan', 'Arifwala',
    // Multan region
    'Multan', 'Shujabad', 'Jalalpur Pirwala', 'Khanewal', 'Kabirwala', 'Mian Channu', 'Jahanian', 'Vehari',
    'Burewala', 'Mailsi', 'Lodhran', 'Kahror Pacca', 'Dunyapur',
    // Bahawalpur region
    'Bahawalpur', 'Ahmedpur East', 'Hasilpur', 'Yazman', 'Bahawalnagar', 'Chishtian', 'Haroonabad',
    'Fort Abbas', 'Minchinabad', 'Rahim Yar Khan', 'Sadiqabad', 'Khanpur', 'Liaquatpur',
    // Dera Ghazi Khan region
    'Dera Ghazi Khan', 'Taunsa', 'Rajanpur', 'Jampur', 'Rojhan', 'Muzaffargarh', 'Kot Addu', 'Alipur', 'Jatoi',
    'Layyah', 'Karor Lal Esan', 'Chowk Azam', 'Fatehpur',
  ],
  Sindh: [
    'Karachi',
    // Hyderabad region
    'Hyderabad', 'Kotri', 'Jamshoro', 'Sehwan', 'Matiari', 'Hala', 'Tando Allahyar', 'Tando Muhammad Khan',
    'Thatta', 'Gharo', 'Sujawal', 'Badin', 'Talhar', 'Golarchi', 'Tando Bago', 'Dadu', 'Mehar', 'Johi',
    // Mirpur Khas region
    'Mirpur Khas', 'Digri', 'Kot Ghulam Muhammad', 'Umerkot', 'Kunri', 'Samaro', 'Mithi', 'Islamkot', 'Diplo',
    'Chachro',
    // Shaheed Benazirabad region
    'Nawabshah', 'Sakrand', 'Daur', 'Sanghar', 'Shahdadpur', 'Tando Adam', 'Shahpur Chakar', 'Naushahro Feroze',
    'Moro', 'Kandiaro', 'Mehrabpur',
    // Sukkur region
    'Sukkur', 'Rohri', 'Pano Aqil', 'Saleh Pat', 'Khairpur', 'Gambat', 'Kot Diji', 'Thari Mirwah', 'Ranipur',
    'Ghotki', 'Daharki', 'Mirpur Mathelo', 'Ubauro',
    // Larkana region
    'Larkana', 'Ratodero', 'Dokri', 'Kambar', 'Shahdadkot', 'Warah', 'Jacobabad', 'Thul', 'Shikarpur',
    'Garhi Yasin', 'Lakhi', 'Kandhkot', 'Kashmore',
  ],
  'Khyber Pakhtunkhwa': [
    // Peshawar region
    'Peshawar', 'Charsadda', 'Shabqadar', 'Tangi', 'Nowshera', 'Risalpur', 'Pabbi', 'Jahangira', 'Akora Khattak',
    'Landi Kotal', 'Jamrud', 'Bara',
    // Mardan region
    'Mardan', 'Takht-i-Bahi', 'Katlang', 'Swabi', 'Topi',
    // Malakand region
    'Mingora', 'Saidu Sharif', 'Barikot', 'Kabal', 'Matta', 'Khwazakhela', 'Bahrain', 'Kalam', 'Batkhela',
    'Dargai', 'Chakdara', 'Timergara', 'Dir', 'Wari', 'Chitral', 'Booni', 'Alpuri', 'Daggar', 'Khar',
    // Hazara region
    'Abbottabad', 'Havelian', 'Nathia Gali', 'Mansehra', 'Balakot', 'Oghi', 'Shinkiari', 'Haripur', 'Ghazi',
    'Battagram', 'Besham', 'Dasu', 'Pattan',
    // Kohat region
    'Kohat', 'Hangu', 'Karak', 'Parachinar', 'Kalaya',
    // Bannu and Dera Ismail Khan regions
    'Bannu', 'Lakki Marwat', 'Miranshah', 'Mir Ali', 'Dera Ismail Khan', 'Kulachi', 'Paharpur', 'Tank', 'Wana',
  ],
  Balochistan: [
    // Quetta region
    'Quetta', 'Pishin', 'Chaman', 'Qila Abdullah', 'Ziarat', 'Kuchlak',
    // Kalat region
    'Kalat', 'Mastung', 'Khuzdar', 'Surab', 'Wadh', 'Kharan', 'Nushki', 'Dalbandin', 'Awaran',
    // Makran region
    'Turbat', 'Gwadar', 'Pasni', 'Ormara', 'Jiwani', 'Panjgur',
    // Lasbela / Hub region
    'Hub', 'Uthal', 'Bela', 'Winder', 'Gadani',
    // Naseerabad and Sibi regions
    'Dera Murad Jamali', 'Dera Allah Yar', 'Usta Muhammad', 'Gandakha', 'Sibi', 'Dhadar', 'Harnai', 'Kohlu',
    'Dera Bugti', 'Sui',
    // Zhob and Loralai regions
    'Zhob', 'Qila Saifullah', 'Musakhel', 'Sherani', 'Loralai', 'Barkhan', 'Duki',
  ],
  'Islamabad Capital Territory': ['Islamabad'],
  'Gilgit-Baltistan': [
    // Gilgit region
    'Gilgit', 'Danyor', 'Jaglot', 'Hunza', 'Aliabad', 'Karimabad', 'Gulmit', 'Sost', 'Nagar', 'Gahkuch', 'Gupis',
    'Yasin', 'Ishkoman',
    // Diamer and Astore
    'Chilas', 'Darel', 'Tangir', 'Astore', 'Eidgah',
    // Baltistan region
    'Skardu', 'Shigar', 'Khaplu', 'Kharmang', 'Roundu',
  ],
  'Azad Jammu and Kashmir': [
    // Mirpur region
    'Mirpur', 'Dadyal', 'Chakswari', 'Islamgarh', 'Kotli', 'Khuiratta', 'Sehnsa', 'Bhimber', 'Barnala', 'Samahni',
    // Muzaffarabad region
    'Muzaffarabad', 'Hattian Bala', 'Chikar', 'Athmuqam', 'Sharda', 'Kel',
    // Poonch region
    'Rawalakot', 'Hajira', 'Abbaspur', 'Bagh', 'Dhirkot', 'Pallandri', 'Forward Kahuta',
  ],
};