insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true);

create policy "Avatar images are publicly accessible." 
on storage.objects for select 
using (bucket_id = 'avatars');

create policy "Users can upload their own avatars." 
on storage.objects for insert 
with check (bucket_id = 'avatars' and auth.uid() = owner);

create policy "Users can update their own avatars." 
on storage.objects for update 
using (bucket_id = 'avatars' and auth.uid() = owner);

create policy "Users can delete their own avatars." 
on storage.objects for delete 
using (bucket_id = 'avatars' and auth.uid() = owner);