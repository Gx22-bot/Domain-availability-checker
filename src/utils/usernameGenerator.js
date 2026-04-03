
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z]/g, '');
}

export function generateUsernames(displayName, count = 25) {
  // Ensure count is a valid number, default to 25 if invalid or 0
  let targetCount = parseInt(count);
  if (isNaN(targetCount) || targetCount <= 0) {
    targetCount = 25;
  }

  if (!displayName) return [];
  
  // Parse name
  const parts = displayName.trim().split(/\s+/);
  const firstRaw = parts[0] || '';
  const lastRaw = parts.length > 1 ? parts[parts.length - 1] : '';
  const middleRaw = parts.length > 2 ? parts.slice(1, parts.length - 1).join('') : '';
  
  const first = normalize(firstRaw);
  const last = normalize(lastRaw);
  const middle = normalize(middleRaw);
  
  const firstInitial = first.charAt(0);
  const lastInitial = last.charAt(0);
  const middleInitial = middle ? middle.charAt(0) : '';
  
  const usernames = new Set();
  
  // Base patterns in priority order
  const patterns = [];
  
  // Helper to shuffle array (Fisher-Yates)
  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  if (first && last) {
    // Helper to add patterns with ONLY one separator
    const addPair = (p1, p2) => {
        patterns.push(`${p1}.${p2}`);
        patterns.push(`${p1}_${p2}`);
    };

    // 1. Full Name Pairs
    addPair(first, last);      // shelby.mccarty, shelby_mccarty
    addPair(last, first);      // mccarty.shelby, mccarty_shelby

    // 2. Middle Name Pairs (if available)
    if (middle) {
        addPair(first, middle);
        addPair(middle, last);
        addPair(middle, first);
        addPair(last, middle);
        
        // Middle Initials
        addPair(first, middleInitial);
        addPair(firstInitial, middle);
        addPair(middle, lastInitial);
        addPair(middleInitial, last);
    }

    // 3. Initial + Full Name
    addPair(firstInitial, last);
    addPair(last, firstInitial);
    addPair(first, lastInitial);
    addPair(lastInitial, first);

    // 4. Initials Only
    addPair(firstInitial, lastInitial);
    addPair(lastInitial, firstInitial);

    // 5. Truncations (2 chars)
    const f2 = first.length >= 2 ? first.substring(0, 2) : first;
    const l2 = last.length >= 2 ? last.substring(0, 2) : last;
    
    addPair(f2, last);
    addPair(last, f2);
    addPair(first, l2);
    addPair(l2, first);
    addPair(f2, l2);
    addPair(l2, f2);

    // 6. Truncations (3 chars)
    if (first.length >= 3) {
        const f3 = first.substring(0, 3);
        addPair(f3, last);
        addPair(last, f3);
        addPair(f3, l2);
        addPair(l2, f3);
        addPair(f3, lastInitial);
        addPair(lastInitial, f3);
        
        if (last.length >= 3) {
            const l3 = last.substring(0, 3);
            addPair(f3, l3);
            addPair(l3, f3);
        }
    }
    
    if (last.length >= 3) {
        const l3 = last.substring(0, 3);
        addPair(first, l3);
        addPair(l3, first);
        addPair(f2, l3);
        addPair(l3, f2);
        addPair(firstInitial, l3);
        addPair(l3, firstInitial);
    }

    // 7. Truncations (4 chars)
    if (first.length >= 4) {
        const f4 = first.substring(0, 4);
        addPair(f4, last);
        addPair(last, f4);
        addPair(f4, l2);
        addPair(f4, lastInitial);
        
        if (last.length >= 4) {
            const l4 = last.substring(0, 4);
            addPair(f4, l4);
            addPair(l4, f4);
        }
    }

    if (last.length >= 4) {
        const l4 = last.substring(0, 4);
        addPair(first, l4);
        addPair(l4, first);
        addPair(f2, l4);
        addPair(firstInitial, l4);
    }

    // 8. Truncations (5 chars)
    if (first.length >= 5) {
        const f5 = first.substring(0, 5);
        addPair(f5, last);
        addPair(last, f5);
        
        if (last.length >= 5) {
            const l5 = last.substring(0, 5);
            addPair(f5, l5);
        }
    }

    if (last.length >= 5) {
        const l5 = last.substring(0, 5);
        addPair(first, l5);
        addPair(l5, first);
    }

    // 9. Repeated Parts (Creative)
    addPair(first, first);      // shelby.shelby
    addPair(last, last);        // mccarty.mccarty
    addPair(first, firstInitial); // shelby.s
    addPair(last, lastInitial);   // mccarty.m

    // 10. Vowel Removal (Disemvoweling)
    const removeVowels = (str) => str.replace(/[aeiou]/g, '');
    const fNoVowels = removeVowels(first);
    const lNoVowels = removeVowels(last);
    
    if (fNoVowels.length >= 2) {
        addPair(fNoVowels, last);
        addPair(last, fNoVowels);
        addPair(fNoVowels, l2);
    }
    if (lNoVowels.length >= 2) {
        addPair(first, lNoVowels);
        addPair(lNoVowels, first);
        addPair(f2, lNoVowels);
    }
    if (fNoVowels.length >= 2 && lNoVowels.length >= 2) {
        addPair(fNoVowels, lNoVowels);
        addPair(lNoVowels, fNoVowels);
    }

    // 11. Reversed Strings
    const reverseString = (str) => str.split('').reverse().join('');
    const fRev = reverseString(first);
    const lRev = reverseString(last);
    
    addPair(fRev, last);
    addPair(last, fRev);
    addPair(first, lRev);
    addPair(lRev, first);
    
    // 12. Suffixes (Last N chars)
    if (first.length >= 3) {
        const fSuffix3 = first.slice(-3);
        addPair(fSuffix3, last);
        addPair(last, fSuffix3);
    }
    if (last.length >= 3) {
        const lSuffix3 = last.slice(-3);
        addPair(first, lSuffix3);
        addPair(lSuffix3, first);
    }

    // 13. Combinatorial Truncations (Exhaustive Mixing)
    // Mix and match all available parts: f1 (initial), f2, f3, f4, f5 with l1, l2, l3, l4, l5
    const fParts = [];
    if (first.length >= 1) fParts.push(first.substring(0, 1));
    if (first.length >= 2) fParts.push(first.substring(0, 2));
    if (first.length >= 3) fParts.push(first.substring(0, 3));
    if (first.length >= 4) fParts.push(first.substring(0, 4));
    if (first.length >= 5) fParts.push(first.substring(0, 5));
    
    const lParts = [];
    if (last.length >= 1) lParts.push(last.substring(0, 1));
    if (last.length >= 2) lParts.push(last.substring(0, 2));
    if (last.length >= 3) lParts.push(last.substring(0, 3));
    if (last.length >= 4) lParts.push(last.substring(0, 4));
    if (last.length >= 5) lParts.push(last.substring(0, 5));
    
    // Mix all truncation parts with each other
    for (const fp of fParts) {
        for (const lp of lParts) {
            addPair(fp, lp);
            addPair(lp, fp);
        }
    }
    
    // Mix all truncation parts with Full Name (more thorough than above sections)
    for (const fp of fParts) {
        addPair(fp, last);
        addPair(last, fp);
    }
    for (const lp of lParts) {
        addPair(first, lp);
        addPair(lp, first);
    }

    // 14. Doubled Initials
    addPair(firstInitial + first, last); // sshelby.mccarty
    addPair(first, lastInitial + last);  // shelby.mmccarty
    addPair(lastInitial + last, first);  // mmccarty.shelby
    addPair(last, firstInitial + first); // mccarty.sshelby

    // 15. Headless Strings (remove first char)
    if (first.length > 2) {
        const fHeadless = first.substring(1);
        addPair(fHeadless, last);
        addPair(last, fHeadless);
    }
    if (last.length > 2) {
        const lHeadless = last.substring(1);
        addPair(first, lHeadless);
        addPair(lHeadless, first);
    }

    // 16. Self-Reflective & Mirroring
    addPair(first, fRev); // shelby.yblehs
    addPair(fRev, first); // yblehs.shelby
    addPair(last, lRev);  // mccarty.ytraccm
    addPair(lRev, last);  // ytraccm.mccarty

    // 17. Spoonerisms (Swap first letters)
    if (first.length > 1 && last.length > 1) {
        const fSwap = lastInitial + first.substring(1);
        const lSwap = firstInitial + last.substring(1);
        addPair(fSwap, lSwap); // mhelby.sccarty
        addPair(lSwap, fSwap); // sccarty.mhelby
    }

    // 18. Repeated Last Letter
    addPair(first + first.slice(-1), last); // shelbyy.mccarty
    addPair(first, last + last.slice(-1));  // shelby.mccartyy
    addPair(first + first.slice(-1), last + last.slice(-1)); // shelbyy.mccartyy

    // 19. Inner Segments (Window Sliding)
    // Extract middle parts: chars 1 to end-1
    if (first.length >= 4) {
        const fMid = first.substring(1, first.length - 1);
        addPair(fMid, last);
        addPair(last, fMid);
    }
    if (last.length >= 4) {
        const lMid = last.substring(1, last.length - 1);
        addPair(first, lMid);
        addPair(lMid, first);
    }

    const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

    const fSuffixes = uniq([
      first.length >= 2 ? first.slice(-2) : '',
      first.length >= 3 ? first.slice(-3) : '',
      first.length >= 4 ? first.slice(-4) : '',
      first.length >= 5 ? first.slice(-5) : ''
    ]);

    const lSuffixes = uniq([
      last.length >= 2 ? last.slice(-2) : '',
      last.length >= 3 ? last.slice(-3) : '',
      last.length >= 4 ? last.slice(-4) : '',
      last.length >= 5 ? last.slice(-5) : ''
    ]);

    const fVariants = uniq([
      first.length > 3 ? first.slice(0, -1) : '',
      first.length > 4 ? first.slice(0, -2) : '',
      first.length > 4 ? first.slice(1) : '',
      first.length > 5 ? first.slice(2) : '',
      first + lastInitial,
      firstInitial + first,
      firstInitial + last
    ]);

    const lVariants = uniq([
      last.length > 3 ? last.slice(0, -1) : '',
      last.length > 4 ? last.slice(0, -2) : '',
      last.length > 4 ? last.slice(1) : '',
      last.length > 5 ? last.slice(2) : '',
      last + firstInitial,
      lastInitial + last,
      lastInitial + first
    ]);

    for (const fp of fSuffixes) {
      addPair(fp, last);
      addPair(last, fp);
    }
    for (const lp of lSuffixes) {
      addPair(first, lp);
      addPair(lp, first);
    }

    for (const fv of fVariants) {
      addPair(fv, last);
      addPair(last, fv);
    }
    for (const lv of lVariants) {
      addPair(first, lv);
      addPair(lv, first);
    }

    for (const fv of fVariants) {
      for (const lv of lVariants) {
        addPair(fv, lv);
        addPair(lv, fv);
      }
    }

    if (middle) {
      const mVariants = uniq([
        middle,
        middleInitial,
        middle.length > 2 ? middle.slice(0, -1) : '',
        middle.length > 3 ? middle.slice(1) : '',
        removeVowels(middle)
      ]);

      for (const mv of mVariants) {
        addPair(first + mv, last);
        addPair(first, mv + last);
        addPair(last + mv, first);
        addPair(last, mv + first);
        addPair(mv, first);
        addPair(mv, last);
      }
    }

  } else if (first) {
    // One word case
    patterns.push(`${first}.${first}`);
    patterns.push(`${first}_${first}`);
  }
  
  // Randomize the order of ALL generated patterns
  // This ensures we don't just get the "good ones" first, but a mix
  // OR do we want "Good ones" first?
  // "randomize the it not just adding" implies mixing.
  const shuffledPatterns = shuffle([...patterns]);
  
  // Add base patterns to set
  for (const p of shuffledPatterns) {
    if (usernames.size < targetCount) {
      if (p.length >= 6) {
        const separatorCount = (p.match(/[._]/g) || []).length;
        const startsWithLetter = /^[a-z]/.test(p);
        if (separatorCount === 1 && startsWithLetter) {
          usernames.add(p);
        }
      }
    }
  }
  
  return Array.from(usernames);
}
